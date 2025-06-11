const claudeAI = require('./claudeAISentimentAnalysis');
const database = require('../utils/database');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

class CorrelationEngine {
  constructor() {
    this.correlationTypes = {
      'cross_app_correlation': this.analyzeCrossAppCorrelation.bind(this),
      'temporal_correlation': this.analyzeTemporalCorrelation.bind(this),
      'behavioral_correlation': this.analyzeBehavioralCorrelation.bind(this),
      'health_outcome_correlation': this.analyzeHealthOutcomeCorrelation.bind(this),
      'intervention_effectiveness': this.analyzeInterventionEffectiveness.bind(this)
    };
  }

  async analyzeCorrelations(config) {
    const startTime = Date.now();
    
    try {
      const {
        analysisType,
        timeframe,
        apps,
        variables,
        minCorrelationStrength,
        includeStatisticalTests
      } = config;

      logger.info('Starting correlation analysis', {
        analysisType,
        apps,
        timeframe,
        variables
      });

      // Get the appropriate analysis function
      const analysisFunction = this.correlationTypes[analysisType];
      if (!analysisFunction) {
        throw new Error(`Unknown analysis type: ${analysisType}`);
      }

      // Prepare data for analysis
      const data = await this.prepareDataForAnalysis(config);
      
      if (data.length < 10) {
        throw new Error('Insufficient data for correlation analysis (minimum 10 data points required)');
      }

      // Perform the specific correlation analysis
      const correlationResults = await analysisFunction(data, config);

      // Apply statistical tests if requested
      let statisticalTests = null;
      if (includeStatisticalTests) {
        statisticalTests = await this.performStatisticalTests(correlationResults, data);
      }

      // Filter by minimum correlation strength
      const significantCorrelations = correlationResults.correlations.filter(corr => 
        Math.abs(corr.coefficient) >= minCorrelationStrength
      );

      const analysis = {
        analysisType,
        timeframe,
        apps,
        summary: {
          totalCorrelations: correlationResults.correlations.length,
          significantCorrelations: significantCorrelations.length,
          strongestCorrelation: this.findStrongestCorrelation(correlationResults.correlations),
          dataPointsAnalyzed: data.length,
          analysisTime: Date.now() - startTime
        },
        correlations: significantCorrelations,
        patterns: correlationResults.patterns || [],
        insights: correlationResults.insights || [],
        ...(statisticalTests && { statisticalTests }),
        metadata: {
          minCorrelationStrength,
          analysisDate: new Date().toISOString(),
          dataQuality: this.assessDataQuality(data)
        }
      };

      // Store analysis results
      await this.storeAnalysisResults(analysis);

      return analysis;

    } catch (error) {
      logger.error('Correlation analysis failed:', error);
      throw error;
    }
  }

  async prepareDataForAnalysis(config) {
    const { timeframe, apps, variables = ['sentiment_score'] } = config;
    
    // Calculate date range
    const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Build query to get correlation data
    let query = `
      SELECT 
        user_id,
        app_name,
        DATE_TRUNC('day', created_at) as analysis_date,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(*) as data_points,
        STRING_AGG(sentiment_category, ',') as sentiment_categories,
        AVG(CASE WHEN sentiment_category = 'positive' THEN 1 ELSE 0 END) as positive_ratio,
        AVG(CASE WHEN sentiment_category = 'negative' THEN 1 ELSE 0 END) as negative_ratio,
        STDDEV(sentiment_score) as sentiment_volatility
      FROM sentiment_data 
      WHERE created_at >= $1
    `;

    const params = [startDate];

    if (apps && apps.length > 0) {
      query += ` AND app_name = ANY($2)`;
      params.push(apps);
    }

    query += `
      GROUP BY user_id, app_name, DATE_TRUNC('day', created_at)
      HAVING COUNT(*) >= 3
      ORDER BY user_id, app_name, analysis_date
    `;

    const result = await database.query(query, params);
    return result.rows;
  }

  async analyzeCrossAppCorrelation(data, config) {
    const { apps } = config;
    const correlations = [];
    const patterns = [];

    // Group data by user and date for cross-app analysis
    const userDateData = {};
    
    data.forEach(row => {
      const key = `${row.user_id}_${row.analysis_date.toISOString().split('T')[0]}`;
      if (!userDateData[key]) {
        userDateData[key] = {};
      }
      userDateData[key][row.app_name] = {
        sentiment: parseFloat(row.avg_sentiment),
        volatility: parseFloat(row.sentiment_volatility || 0),
        positiveRatio: parseFloat(row.positive_ratio),
        negativeRatio: parseFloat(row.negative_ratio),
        dataPoints: parseInt(row.data_points)
      };
    });

    // Calculate correlations between app pairs
    for (let i = 0; i < apps.length; i++) {
      for (let j = i + 1; j < apps.length; j++) {
        const app1 = apps[i];
        const app2 = apps[j];
        
        const pairData = Object.values(userDateData)
          .filter(userData => userData[app1] && userData[app2])
          .map(userData => ({
            app1Sentiment: userData[app1].sentiment,
            app2Sentiment: userData[app2].sentiment,
            app1Volatility: userData[app1].volatility,
            app2Volatility: userData[app2].volatility
          }));

        if (pairData.length >= 5) {
          const sentimentCorrelation = this.calculatePearsonCorrelation(
            pairData.map(d => d.app1Sentiment),
            pairData.map(d => d.app2Sentiment)
          );

          const volatilityCorrelation = this.calculatePearsonCorrelation(
            pairData.map(d => d.app1Volatility),
            pairData.map(d => d.app2Volatility)
          );

          correlations.push({
            apps: [app1, app2],
            type: 'sentiment_correlation',
            coefficient: sentimentCorrelation,
            dataPoints: pairData.length,
            strength: this.categorizeCorrelationStrength(sentimentCorrelation),
            metadata: {
              volatilityCorrelation,
              avgApp1Sentiment: pairData.reduce((sum, d) => sum + d.app1Sentiment, 0) / pairData.length,
              avgApp2Sentiment: pairData.reduce((sum, d) => sum + d.app2Sentiment, 0) / pairData.length
            }
          });

          // Identify patterns
          if (Math.abs(sentimentCorrelation) > 0.5) {
            patterns.push({
              type: sentimentCorrelation > 0 ? 'positive_correlation' : 'negative_correlation',
              apps: [app1, app2],
              description: `${app1} and ${app2} show ${sentimentCorrelation > 0 ? 'synchronized' : 'inverse'} sentiment patterns`,
              strength: Math.abs(sentimentCorrelation),
              implication: sentimentCorrelation > 0 
                ? 'Users experience similar sentiment states across both apps'
                : 'Negative sentiment in one app often corresponds to positive sentiment in the other'
            });
          }
        }
      }
    }

    return {
      correlations,
      patterns,
      insights: this.generateCrossAppInsights(correlations, patterns)
    };
  }

  async analyzeTemporalCorrelation(data, config) {
    const correlations = [];
    const patterns = [];

    // Group data by user for temporal analysis
    const userData = {};
    data.forEach(row => {
      if (!userData[row.user_id]) {
        userData[row.user_id] = {};
      }
      if (!userData[row.user_id][row.app_name]) {
        userData[row.user_id][row.app_name] = [];
      }
      userData[row.user_id][row.app_name].push({
        date: row.analysis_date,
        sentiment: parseFloat(row.avg_sentiment),
        volatility: parseFloat(row.sentiment_volatility || 0)
      });
    });

    // Analyze temporal patterns for each user-app combination
    Object.keys(userData).forEach(userId => {
      Object.keys(userData[userId]).forEach(appName => {
        const userAppData = userData[userId][appName].sort((a, b) => a.date - b.date);
        
        if (userAppData.length >= 7) { // Need at least a week of data
          // Calculate lag correlations (1-day, 3-day, 7-day lags)
          const lagCorrelations = this.calculateLagCorrelations(userAppData);
          
          correlations.push({
            user: userId.substring(0, 8) + '...',
            app: appName,
            type: 'temporal_autocorrelation',
            lagCorrelations,
            trendStrength: this.calculateTrendStrength(userAppData),
            cyclicalPattern: this.detectCyclicalPattern(userAppData)
          });

          // Detect significant temporal patterns
          if (lagCorrelations.lag1 > 0.3) {
            patterns.push({
              type: 'persistence_pattern',
              app: appName,
              description: 'Sentiment shows strong day-to-day persistence',
              strength: lagCorrelations.lag1,
              implication: 'Current sentiment state strongly predicts next-day sentiment'
            });
          }

          if (lagCorrelations.lag7 > 0.2) {
            patterns.push({
              type: 'weekly_pattern',
              app: appName,
              description: 'Sentiment shows weekly cyclical patterns',
              strength: lagCorrelations.lag7,
              implication: 'Sentiment follows weekly cycles, possibly related to routine'
            });
          }
        }
      });
    });

    return {
      correlations,
      patterns,
      insights: this.generateTemporalInsights(correlations, patterns)
    };
  }

  async analyzeBehavioralCorrelation(data, config) {
    const correlations = [];
    const patterns = [];

    // Analyze relationships between engagement patterns and sentiment
    const behavioralData = data.map(row => ({
      userId: row.user_id,
      app: row.app_name,
      sentiment: parseFloat(row.avg_sentiment),
      engagementLevel: parseInt(row.data_points), // Using data points as proxy for engagement
      positiveRatio: parseFloat(row.positive_ratio),
      negativeRatio: parseFloat(row.negative_ratio),
      volatility: parseFloat(row.sentiment_volatility || 0)
    }));

    // Group by app for behavioral analysis
    const appBehaviorData = {};
    behavioralData.forEach(row => {
      if (!appBehaviorData[row.app]) {
        appBehaviorData[row.app] = [];
      }
      appBehaviorData[row.app].push(row);
    });

    Object.keys(appBehaviorData).forEach(appName => {
      const appData = appBehaviorData[appName];
      
      if (appData.length >= 10) {
        // Correlation between engagement and sentiment
        const engagementSentimentCorr = this.calculatePearsonCorrelation(
          appData.map(d => d.engagementLevel),
          appData.map(d => d.sentiment)
        );

        // Correlation between engagement and volatility
        const engagementVolatilityCorr = this.calculatePearsonCorrelation(
          appData.map(d => d.engagementLevel),
          appData.map(d => d.volatility)
        );

        correlations.push({
          app: appName,
          type: 'engagement_sentiment_correlation',
          coefficient: engagementSentimentCorr,
          dataPoints: appData.length,
          strength: this.categorizeCorrelationStrength(engagementSentimentCorr),
          metadata: {
            engagementVolatilityCorrelation: engagementVolatilityCorr,
            avgEngagement: appData.reduce((sum, d) => sum + d.engagementLevel, 0) / appData.length,
            avgSentiment: appData.reduce((sum, d) => sum + d.sentiment, 0) / appData.length
          }
        });

        // Behavioral patterns
        if (engagementSentimentCorr > 0.3) {
          patterns.push({
            type: 'positive_engagement_pattern',
            app: appName,
            description: 'Higher engagement correlates with more positive sentiment',
            strength: engagementSentimentCorr,
            implication: 'Users who engage more with the app tend to have better sentiment'
          });
        } else if (engagementSentimentCorr < -0.3) {
          patterns.push({
            type: 'distress_engagement_pattern',
            app: appName,
            description: 'Higher engagement correlates with more negative sentiment',
            strength: Math.abs(engagementSentimentCorr),
            implication: 'Users may engage more when experiencing distress'
          });
        }
      }
    });

    return {
      correlations,
      patterns,
      insights: this.generateBehavioralInsights(correlations, patterns)
    };
  }

  async analyzeHealthOutcomeCorrelation(data, config) {
    const correlations = [];
    const patterns = [];

    // Simulate health outcome correlation analysis
    // In a real implementation, this would integrate with health data
    
    const healthOutcomeData = data.map(row => ({
      userId: row.user_id,
      app: row.app_name,
      sentiment: parseFloat(row.avg_sentiment),
      volatility: parseFloat(row.sentiment_volatility || 0),
      // Simulated health indicators based on sentiment patterns
      stressLevel: Math.max(0, 1 - row.avg_sentiment + (row.sentiment_volatility || 0)),
      wellbeingScore: Math.max(0, Math.min(1, row.avg_sentiment + 0.5)),
      riskScore: Math.max(0, Math.min(1, -row.avg_sentiment + (row.sentiment_volatility || 0) + 0.3))
    }));

    // Group by app for health correlation analysis
    const appHealthData = {};
    healthOutcomeData.forEach(row => {
      if (!appHealthData[row.app]) {
        appHealthData[row.app] = [];
      }
      appHealthData[row.app].push(row);
    });

    Object.keys(appHealthData).forEach(appName => {
      const appData = appHealthData[appName];
      
      if (appData.length >= 10) {
        // Correlations with health indicators
        const sentimentStressCorr = this.calculatePearsonCorrelation(
          appData.map(d => d.sentiment),
          appData.map(d => d.stressLevel)
        );

        const sentimentWellbeingCorr = this.calculatePearsonCorrelation(
          appData.map(d => d.sentiment),
          appData.map(d => d.wellbeingScore)
        );

        const volatilityRiskCorr = this.calculatePearsonCorrelation(
          appData.map(d => d.volatility),
          appData.map(d => d.riskScore)
        );

        correlations.push({
          app: appName,
          type: 'health_outcome_correlation',
          healthCorrelations: {
            sentimentStress: sentimentStressCorr,
            sentimentWellbeing: sentimentWellbeingCorr,
            volatilityRisk: volatilityRiskCorr
          },
          dataPoints: appData.length,
          metadata: {
            avgStressLevel: appData.reduce((sum, d) => sum + d.stressLevel, 0) / appData.length,
            avgWellbeingScore: appData.reduce((sum, d) => sum + d.wellbeingScore, 0) / appData.length,
            avgRiskScore: appData.reduce((sum, d) => sum + d.riskScore, 0) / appData.length
          }
        });

        // Health outcome patterns
        if (Math.abs(sentimentStressCorr) > 0.4) {
          patterns.push({
            type: 'stress_sentiment_pattern',
            app: appName,
            description: 'Strong relationship between sentiment and stress levels',
            strength: Math.abs(sentimentStressCorr),
            implication: 'App sentiment data can be predictive of user stress levels'
          });
        }

        if (volatilityRiskCorr > 0.3) {
          patterns.push({
            type: 'volatility_risk_pattern',
            app: appName,
            description: 'Sentiment volatility correlates with health risk indicators',
            strength: volatilityRiskCorr,
            implication: 'Emotional instability may be an early warning sign'
          });
        }
      }
    });

    return {
      correlations,
      patterns,
      insights: this.generateHealthInsights(correlations, patterns)
    };
  }

  async analyzeInterventionEffectiveness(data, config) {
    const correlations = [];
    const patterns = [];

    // Simulate intervention effectiveness analysis
    // This would require additional intervention data in a real implementation
    
    // Analyze sentiment changes around potential intervention points
    const interventionData = [];
    
    // Group data by user for intervention analysis
    const userData = {};
    data.forEach(row => {
      if (!userData[row.user_id]) {
        userData[row.user_id] = [];
      }
      userData[row.user_id].push({
        date: row.analysis_date,
        app: row.app_name,
        sentiment: parseFloat(row.avg_sentiment),
        volatility: parseFloat(row.sentiment_volatility || 0)
      });
    });

    Object.keys(userData).forEach(userId => {
      const userTimeline = userData[userId].sort((a, b) => a.date - b.date);
      
      // Identify potential intervention points (significant sentiment drops)
      for (let i = 3; i < userTimeline.length - 3; i++) {
        const current = userTimeline[i];
        const before = userTimeline.slice(i-3, i);
        const after = userTimeline.slice(i+1, i+4);
        
        const avgBefore = before.reduce((sum, d) => sum + d.sentiment, 0) / before.length;
        const avgAfter = after.reduce((sum, d) => sum + d.sentiment, 0) / after.length;
        
        // Detect significant drops followed by recovery
        if (current.sentiment < avgBefore - 0.3 && avgAfter > current.sentiment + 0.2) {
          interventionData.push({
            userId,
            interventionDate: current.date,
            app: current.app,
            preIntervention: avgBefore,
            interventionPoint: current.sentiment,
            postIntervention: avgAfter,
            recoveryStrength: avgAfter - current.sentiment,
            timeToRecovery: 3 // days (simplified)
          });
        }
      }
    });

    if (interventionData.length > 0) {
      // Analyze intervention effectiveness patterns
      const appInterventions = {};
      interventionData.forEach(intervention => {
        if (!appInterventions[intervention.app]) {
          appInterventions[intervention.app] = [];
        }
        appInterventions[intervention.app].push(intervention);
      });

      Object.keys(appInterventions).forEach(appName => {
        const appInterventions_data = appInterventions[appName];
        
        if (appInterventions_data.length >= 3) {
          const avgRecoveryStrength = appInterventions_data.reduce((sum, i) => sum + i.recoveryStrength, 0) / appInterventions_data.length;
          const avgTimeToRecovery = appInterventions_data.reduce((sum, i) => sum + i.timeToRecovery, 0) / appInterventions_data.length;
          
          correlations.push({
            app: appName,
            type: 'intervention_effectiveness',
            interventionCount: appInterventions_data.length,
            avgRecoveryStrength,
            avgTimeToRecovery,
            successRate: appInterventions_data.filter(i => i.recoveryStrength > 0.2).length / appInterventions_data.length
          });

          if (avgRecoveryStrength > 0.3) {
            patterns.push({
              type: 'effective_recovery_pattern',
              app: appName,
              description: 'Strong natural recovery patterns observed',
              strength: avgRecoveryStrength,
              implication: 'Users show resilience and recovery after sentiment drops'
            });
          }
        }
      });
    }

    return {
      correlations,
      patterns,
      insights: this.generateInterventionInsights(correlations, patterns)
    };
  }

  calculatePearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  calculateLagCorrelations(timeSeriesData) {
    const sentiments = timeSeriesData.map(d => d.sentiment);
    
    return {
      lag1: this.calculateLagCorrelation(sentiments, 1),
      lag3: this.calculateLagCorrelation(sentiments, 3),
      lag7: this.calculateLagCorrelation(sentiments, 7)
    };
  }

  calculateLagCorrelation(data, lag) {
    if (data.length <= lag) return 0;
    
    const x = data.slice(0, -lag);
    const y = data.slice(lag);
    
    return this.calculatePearsonCorrelation(x, y);
  }

  calculateTrendStrength(timeSeriesData) {
    const values = timeSeriesData.map(d => d.sentiment);
    const x = Array.from({length: values.length}, (_, i) => i);
    
    const correlation = this.calculatePearsonCorrelation(x, values);
    return Math.abs(correlation);
  }

  detectCyclicalPattern(timeSeriesData) {
    // Simplified cyclical pattern detection
    const sentiments = timeSeriesData.map(d => d.sentiment);
    
    if (sentiments.length < 14) return null;
    
    // Check for weekly patterns
    const weeklyPattern = this.calculateLagCorrelation(sentiments, 7);
    
    return {
      weeklyStrength: weeklyPattern,
      hasCyclicalPattern: Math.abs(weeklyPattern) > 0.2
    };
  }

  categorizeCorrelationStrength(correlation) {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'strong';
    if (abs >= 0.5) return 'moderate';
    if (abs >= 0.3) return 'weak';
    return 'negligible';
  }

  findStrongestCorrelation(correlations) {
    if (correlations.length === 0) return null;
    
    return correlations.reduce((strongest, current) => {
      const currentStrength = Math.abs(current.coefficient || 0);
      const strongestStrength = Math.abs(strongest.coefficient || 0);
      return currentStrength > strongestStrength ? current : strongest;
    });
  }

  assessDataQuality(data) {
    const uniqueUsers = new Set(data.map(d => d.user_id)).size;
    const uniqueApps = new Set(data.map(d => d.app_name)).size;
    const avgDataPointsPerRecord = data.reduce((sum, d) => sum + parseInt(d.data_points), 0) / data.length;
    
    return {
      totalRecords: data.length,
      uniqueUsers,
      uniqueApps,
      avgDataPointsPerRecord: Math.round(avgDataPointsPerRecord),
      quality: data.length > 100 && uniqueUsers > 10 ? 'high' : 
               data.length > 30 && uniqueUsers > 5 ? 'medium' : 'low'
    };
  }

  async performStatisticalTests(correlationResults, data) {
    // Simplified statistical tests
    return {
      sampleSize: data.length,
      significanceLevel: 0.05,
      powerAnalysis: {
        achieved: data.length > 30 ? 'adequate' : 'limited',
        recommendedSampleSize: Math.max(100, data.length)
      },
      confidenceIntervals: correlationResults.correlations.map(corr => ({
        correlation: corr.coefficient,
        lowerBound: Math.max(-1, corr.coefficient - 0.1),
        upperBound: Math.min(1, corr.coefficient + 0.1)
      }))
    };
  }

  generateCrossAppInsights(correlations, patterns) {
    const insights = [];
    
    if (patterns.some(p => p.type === 'positive_correlation')) {
      insights.push({
        type: 'synchronized_experience',
        message: 'Users show synchronized sentiment patterns across multiple apps, suggesting holistic emotional states',
        recommendation: 'Consider coordinated interventions across app ecosystem'
      });
    }
    
    if (patterns.some(p => p.type === 'negative_correlation')) {
      insights.push({
        type: 'compensatory_behavior',
        message: 'Some apps show inverse sentiment patterns, indicating potential compensatory app usage',
        recommendation: 'Analyze if users turn to specific apps during distress'
      });
    }
    
    return insights;
  }

  generateTemporalInsights(correlations, patterns) {
    const insights = [];
    
    if (patterns.some(p => p.type === 'persistence_pattern')) {
      insights.push({
        type: 'emotional_persistence',
        message: 'Strong day-to-day sentiment persistence indicates emotional state stability',
        recommendation: 'Consider momentum-based intervention strategies'
      });
    }
    
    if (patterns.some(p => p.type === 'weekly_pattern')) {
      insights.push({
        type: 'routine_influence',
        message: 'Weekly sentiment patterns suggest routine and schedule influence on emotional state',
        recommendation: 'Time interventions based on weekly cycles'
      });
    }
    
    return insights;
  }

  generateBehavioralInsights(correlations, patterns) {
    const insights = [];
    
    if (patterns.some(p => p.type === 'positive_engagement_pattern')) {
      insights.push({
        type: 'engagement_benefits',
        message: 'Higher app engagement correlates with better sentiment outcomes',
        recommendation: 'Encourage regular app engagement through positive reinforcement'
      });
    }
    
    if (patterns.some(p => p.type === 'distress_engagement_pattern')) {
      insights.push({
        type: 'crisis_engagement',
        message: 'Users engage more during distress periods',
        recommendation: 'Optimize crisis support features for high-engagement periods'
      });
    }
    
    return insights;
  }

  generateHealthInsights(correlations, patterns) {
    const insights = [];
    
    if (patterns.some(p => p.type === 'stress_sentiment_pattern')) {
      insights.push({
        type: 'predictive_potential',
        message: 'App sentiment data shows strong predictive potential for health outcomes',
        recommendation: 'Develop early warning systems based on sentiment patterns'
      });
    }
    
    if (patterns.some(p => p.type === 'volatility_risk_pattern')) {
      insights.push({
        type: 'early_warning',
        message: 'Emotional volatility serves as early warning indicator for health risks',
        recommendation: 'Monitor sentiment volatility for intervention triggers'
      });
    }
    
    return insights;
  }

  generateInterventionInsights(correlations, patterns) {
    const insights = [];
    
    if (patterns.some(p => p.type === 'effective_recovery_pattern')) {
      insights.push({
        type: 'natural_resilience',
        message: 'Users demonstrate natural recovery patterns after sentiment drops',
        recommendation: 'Support natural resilience mechanisms rather than over-intervening'
      });
    }
    
    return insights;
  }

  async storeAnalysisResults(analysis) {
    try {
      const query = `
        INSERT INTO correlation_analyses (
          analysis_type, app_combinations, user_cohort_size,
          correlation_strength, key_findings, methodology, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      const values = [
        analysis.analysisType,
        analysis.apps,
        analysis.metadata.dataQuality.uniqueUsers || 0,
        analysis.summary.strongestCorrelation?.coefficient || 0,
        JSON.stringify(analysis.insights),
        JSON.stringify({
          timeframe: analysis.timeframe,
          minCorrelationStrength: analysis.metadata.minCorrelationStrength,
          analysisTime: analysis.summary.analysisTime
        }),
        new Date()
      ];
      
      await database.query(query, values);
      
      logger.info('Correlation analysis results stored', {
        analysisType: analysis.analysisType,
        correlationCount: analysis.summary.totalCorrelations,
        significantCorrelations: analysis.summary.significantCorrelations
      });
      
    } catch (error) {
      logger.error('Failed to store correlation analysis results:', error);
    }
  }
}

module.exports = new CorrelationEngine();