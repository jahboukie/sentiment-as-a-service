const express = require('express');
const router = express.Router();
const Joi = require('joi');
const database = require('../utils/database');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const sentimentService = require('../services/sentimentAnalysis');
const authMiddleware = require('../middleware/auth');

// Apply usage tracking to all enterprise routes
router.use(authMiddleware.trackUsage);

// Validation schemas
const batchAnalysisSchema = Joi.object({
  texts: Joi.array().items(Joi.string().min(1).max(10000)).max(100).required(),
  includeEmotions: Joi.boolean().default(true),
  includeKeyTerms: Joi.boolean().default(false),
  cacheResults: Joi.boolean().default(true)
});

const trendAnalysisSchema = Joi.object({
  timeframe: Joi.string().valid('1d', '7d', '30d', '90d', '1y').default('30d'),
  appNames: Joi.array().items(Joi.string()).optional(),
  granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day'),
  includeBreakdown: Joi.boolean().default(true)
});

// Enterprise Sentiment Analysis API
router.post('/sentiment/analyze', authMiddleware.checkEndpointPermission('sentiment_analysis'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = batchAnalysisSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { texts, includeEmotions, includeKeyTerms, cacheResults } = value;
    const results = [];
    
    logger.info('Enterprise sentiment analysis started', {
      clientId: req.enterpriseClient.id,
      textCount: texts.length,
      includeEmotions,
      includeKeyTerms
    });

    for (const text of texts) {
      try {
        const analysis = await sentimentService.analyzeSentiment(text);
        
        const result = {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          sentiment: {
            score: analysis.score,
            category: analysis.category,
            confidence: analysis.confidence
          }
        };

        if (includeEmotions) {
          result.emotions = analysis.emotions;
        }

        if (includeKeyTerms) {
          result.keyTerms = analysis.context.keyTerms;
        }

        results.push(result);

      } catch (analysisError) {
        logger.error('Individual text analysis failed:', analysisError);
        results.push({
          text: text.substring(0, 100) + '...',
          error: 'Analysis failed',
          details: 'Unable to process this text'
        });
      }
    }

    // Track data points processed for billing
    req.dataPointsProcessed = texts.length;

    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      results,
      summary: {
        totalTexts: texts.length,
        successfulAnalyses: results.filter(r => !r.error).length,
        failedAnalyses: results.filter(r => r.error).length,
        processingTime: responseTime
      },
      apiUsage: {
        dataPointsProcessed: texts.length,
        remainingQuota: req.enterpriseClient.monthly_quota - req.enterpriseClient.current_usage
      }
    });

  } catch (error) {
    logger.error('Enterprise sentiment analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: 'Internal server error'
    });
  }
});

// Trend Analysis API
router.get('/analytics/trends', authMiddleware.checkEndpointPermission('analytics'), async (req, res) => {
  try {
    const { error, value } = trendAnalysisSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { timeframe, appNames, granularity, includeBreakdown } = value;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build query based on granularity
    let dateFormat;
    switch (granularity) {
      case 'hour':
        dateFormat = "DATE_TRUNC('hour', created_at)";
        break;
      case 'day':
        dateFormat = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        dateFormat = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateFormat = "DATE_TRUNC('month', created_at)";
        break;
    }

    let query = `
      SELECT 
        ${dateFormat} as period,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(*) as data_points,
        COUNT(CASE WHEN sentiment_category = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_category = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN sentiment_category = 'neutral' THEN 1 END) as neutral_count,
        COUNT(DISTINCT user_id) as unique_users
    `;

    if (includeBreakdown) {
      query += `, app_name`;
    }

    query += `
      FROM sentiment_data 
      WHERE created_at >= $1
    `;

    const params = [startDate];
    let paramIndex = 2;

    if (appNames && appNames.length > 0) {
      query += ` AND app_name = ANY($${paramIndex})`;
      params.push(appNames);
      paramIndex++;
    }

    query += ` GROUP BY period`;
    if (includeBreakdown) {
      query += `, app_name`;
    }
    query += ` ORDER BY period`;

    const result = await database.query(query, params);

    // Process results for better visualization
    const trends = result.rows.map(row => ({
      period: row.period,
      avgSentiment: parseFloat(row.avg_sentiment).toFixed(3),
      dataPoints: parseInt(row.data_points),
      distribution: {
        positive: parseInt(row.positive_count),
        negative: parseInt(row.negative_count),
        neutral: parseInt(row.neutral_count)
      },
      uniqueUsers: parseInt(row.unique_users),
      ...(includeBreakdown && { appName: row.app_name })
    }));

    // Calculate overall statistics
    const totalDataPoints = trends.reduce((sum, t) => sum + t.dataPoints, 0);
    const avgSentiment = trends.length > 0 
      ? trends.reduce((sum, t) => sum + parseFloat(t.avgSentiment), 0) / trends.length 
      : 0;

    req.dataPointsProcessed = Math.ceil(totalDataPoints / 100); // Billing calculation

    res.json({
      success: true,
      timeframe,
      granularity,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalDataPoints,
        avgSentiment: avgSentiment.toFixed(3),
        periodsAnalyzed: trends.length
      },
      trends,
      apiUsage: {
        dataPointsProcessed: req.dataPointsProcessed,
        remainingQuota: req.enterpriseClient.monthly_quota - req.enterpriseClient.current_usage
      }
    });

  } catch (error) {
    logger.error('Trend analysis error:', error);
    res.status(500).json({
      error: 'Trend analysis failed',
      message: 'Internal server error'
    });
  }
});

// Cross-App Correlation Analysis
router.post('/analytics/correlations', authMiddleware.checkEndpointPermission('advanced_analytics'), async (req, res) => {
  try {
    const { 
      appCombinations, 
      timeframe = '30d', 
      minCorrelationStrength = 0.3,
      analysisType = 'sentiment_correlation' 
    } = req.body;

    if (!appCombinations || appCombinations.length < 2) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'At least 2 apps required for correlation analysis'
      });
    }

    // Calculate date range
    const now = new Date();
    const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Query for correlation data
    const query = `
      WITH app_data AS (
        SELECT 
          user_id,
          app_name,
          DATE_TRUNC('day', created_at) as day,
          AVG(sentiment_score) as daily_sentiment,
          COUNT(*) as daily_entries
        FROM sentiment_data 
        WHERE created_at >= $1 
        AND app_name = ANY($2)
        GROUP BY user_id, app_name, DATE_TRUNC('day', created_at)
        HAVING COUNT(*) >= 3  -- Minimum data points per day
      ),
      user_app_combinations AS (
        SELECT 
          a1.user_id,
          a1.day,
          a1.app_name as app1,
          a1.daily_sentiment as sentiment1,
          a2.app_name as app2,
          a2.daily_sentiment as sentiment2
        FROM app_data a1
        JOIN app_data a2 ON a1.user_id = a2.user_id 
                          AND a1.day = a2.day 
                          AND a1.app_name < a2.app_name
      )
      SELECT 
        app1,
        app2,
        COUNT(*) as data_points,
        CORR(sentiment1, sentiment2) as correlation_coefficient,
        AVG(sentiment1) as avg_sentiment_app1,
        AVG(sentiment2) as avg_sentiment_app2,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_app_combinations
      GROUP BY app1, app2
      HAVING COUNT(*) >= 10 AND COUNT(DISTINCT user_id) >= 5
      ORDER BY ABS(CORR(sentiment1, sentiment2)) DESC
    `;

    const result = await database.query(query, [startDate, appCombinations]);

    // Filter by minimum correlation strength
    const significantCorrelations = result.rows.filter(row => 
      Math.abs(row.correlation_coefficient) >= minCorrelationStrength
    );

    // Store analysis results
    for (const correlation of significantCorrelations) {
      const analysisQuery = `
        INSERT INTO correlation_analyses (
          analysis_type, app_combinations, user_cohort_size,
          correlation_strength, key_findings, methodology
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const findings = {
        correlationType: correlation.correlation_coefficient > 0 ? 'positive' : 'negative',
        strength: Math.abs(correlation.correlation_coefficient),
        dataPoints: correlation.data_points,
        avgSentiments: {
          [correlation.app1]: correlation.avg_sentiment_app1,
          [correlation.app2]: correlation.avg_sentiment_app2
        }
      };

      const methodology = {
        timeframe,
        analysisType,
        minDataPointsPerDay: 3,
        minTotalDataPoints: 10,
        minUniqueUsers: 5
      };

      await database.query(analysisQuery, [
        analysisType,
        [correlation.app1, correlation.app2],
        correlation.unique_users,
        correlation.correlation_coefficient,
        JSON.stringify(findings),
        JSON.stringify(methodology)
      ]);
    }

    req.dataPointsProcessed = result.rows.length * 10; // Complex analysis billing

    logger.info('Correlation analysis completed', {
      clientId: req.enterpriseClient.id,
      appCombinations: appCombinations.length,
      significantCorrelations: significantCorrelations.length
    });

    res.json({
      success: true,
      analysisType,
      timeframe,
      summary: {
        appCombinations: appCombinations.length,
        totalCorrelations: result.rows.length,
        significantCorrelations: significantCorrelations.length,
        minCorrelationStrength
      },
      correlations: significantCorrelations.map(row => ({
        apps: [row.app1, row.app2],
        correlationCoefficient: parseFloat(row.correlation_coefficient).toFixed(4),
        strength: Math.abs(row.correlation_coefficient) > 0.7 ? 'strong' : 
                 Math.abs(row.correlation_coefficient) > 0.5 ? 'moderate' : 'weak',
        dataPoints: parseInt(row.data_points),
        uniqueUsers: parseInt(row.unique_users),
        avgSentiments: {
          [row.app1]: parseFloat(row.avg_sentiment_app1).toFixed(3),
          [row.app2]: parseFloat(row.avg_sentiment_app2).toFixed(3)
        }
      })),
      apiUsage: {
        dataPointsProcessed: req.dataPointsProcessed,
        remainingQuota: req.enterpriseClient.monthly_quota - req.enterpriseClient.current_usage
      }
    });

  } catch (error) {
    logger.error('Correlation analysis error:', error);
    res.status(500).json({
      error: 'Correlation analysis failed',
      message: 'Internal server error'
    });
  }
});

// Real-time Sentiment Monitoring
router.get('/monitoring/realtime', authMiddleware.checkEndpointPermission('realtime_monitoring'), async (req, res) => {
  try {
    const { appNames, alertThreshold = 0.3 } = req.query;
    
    // Get recent sentiment data (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    let query = `
      SELECT 
        app_name,
        COUNT(*) as recent_entries,
        AVG(sentiment_score) as avg_sentiment,
        MIN(sentiment_score) as min_sentiment,
        MAX(sentiment_score) as max_sentiment,
        STDDEV(sentiment_score) as sentiment_volatility,
        COUNT(CASE WHEN sentiment_score < -0.5 THEN 1 END) as critical_negative_count
      FROM sentiment_data 
      WHERE created_at >= $1
    `;

    const params = [oneHourAgo];

    if (appNames) {
      const appArray = Array.isArray(appNames) ? appNames : [appNames];
      query += ` AND app_name = ANY($2)`;
      params.push(appArray);
    }

    query += ` GROUP BY app_name ORDER BY avg_sentiment ASC`;

    const result = await database.query(query, params);

    // Identify alerts
    const alerts = result.rows.filter(row => 
      parseFloat(row.avg_sentiment) < -alertThreshold ||
      parseInt(row.critical_negative_count) > 5
    );

    req.dataPointsProcessed = 1; // Real-time monitoring is light on billing

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      timeWindow: '1 hour',
      monitoring: result.rows.map(row => ({
        appName: row.app_name,
        recentEntries: parseInt(row.recent_entries),
        avgSentiment: parseFloat(row.avg_sentiment).toFixed(3),
        sentimentRange: {
          min: parseFloat(row.min_sentiment).toFixed(3),
          max: parseFloat(row.max_sentiment).toFixed(3)
        },
        volatility: parseFloat(row.sentiment_volatility || 0).toFixed(3),
        criticalNegativeCount: parseInt(row.critical_negative_count),
        status: parseFloat(row.avg_sentiment) < -alertThreshold ? 'alert' : 'normal'
      })),
      alerts: alerts.map(alert => ({
        appName: alert.app_name,
        severity: alert.avg_sentiment < -0.6 ? 'high' : 'medium',
        avgSentiment: parseFloat(alert.avg_sentiment).toFixed(3),
        criticalCount: parseInt(alert.critical_negative_count),
        message: `${alert.app_name} showing concerning sentiment patterns`
      }))
    });

  } catch (error) {
    logger.error('Real-time monitoring error:', error);
    res.status(500).json({
      error: 'Monitoring failed',
      message: 'Internal server error'
    });
  }
});

module.exports = router;