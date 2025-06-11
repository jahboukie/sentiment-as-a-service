const crypto = require('crypto');
const logger = require('../utils/logger');
const database = require('../utils/database');
const redis = require('../utils/redis');

class MLTrainingService {
  constructor() {
    this.activeJobs = new Map();
    this.federatedJobs = new Map();
  }

  async startTraining(config) {
    const jobId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      const {
        modelName,
        modelType,
        trainingData,
        hyperparameters,
        trainingOptions,
        clientId
      } = config;

      logger.info('Starting ML training job', {
        jobId,
        modelName,
        modelType,
        clientId
      });

      // Create model record
      const modelId = crypto.randomUUID();
      const modelQuery = `
        INSERT INTO ml_models (
          id, model_name, model_type, training_data_summary,
          performance_metrics, version, trained_by, deployment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const trainingDataSummary = {
        ...trainingData,
        hyperparameters,
        trainingOptions,
        startTime: new Date().toISOString()
      };

      const modelValues = [
        modelId,
        modelName,
        modelType,
        JSON.stringify(trainingDataSummary),
        JSON.stringify({}), // Will be updated when training completes
        '1.0.0',
        clientId,
        'training'
      ];

      await database.query(modelQuery, modelValues);

      // Start training process (simulated for this implementation)
      const trainingJob = {
        id: jobId,
        modelId,
        status: 'training',
        progress: 0,
        startTime,
        estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        config
      };

      this.activeJobs.set(jobId, trainingJob);

      // Simulate training process
      this.simulateTraining(jobId, trainingJob);

      return {
        id: jobId,
        modelId,
        estimatedCompletion: trainingJob.estimatedCompletion
      };

    } catch (error) {
      logger.error('Failed to start training:', error);
      throw error;
    }
  }

  async simulateTraining(jobId, job) {
    try {
      const totalSteps = 100;
      let currentStep = 0;

      const interval = setInterval(async () => {
        currentStep += Math.random() * 5; // Simulate variable progress
        
        if (currentStep >= totalSteps) {
          currentStep = totalSteps;
          clearInterval(interval);
          
          // Complete training
          await this.completeTraining(jobId, job);
        }

        // Update progress
        job.progress = Math.min(currentStep / totalSteps, 1.0);
        job.currentStep = Math.floor(currentStep);
        
        // Cache progress in Redis
        await redis.client?.setex(
          `training_progress:${jobId}`, 
          3600, 
          JSON.stringify({
            progress: job.progress,
            currentStep: job.currentStep,
            status: job.status,
            estimatedCompletion: job.estimatedCompletion
          })
        );

        logger.info('Training progress update', {
          jobId,
          progress: Math.round(job.progress * 100),
          step: job.currentStep
        });

      }, 2000); // Update every 2 seconds

    } catch (error) {
      logger.error('Training simulation error:', error);
      await this.failTraining(jobId, error.message);
    }
  }

  async completeTraining(jobId, job) {
    try {
      logger.info('Completing training job', { jobId });

      // Generate realistic performance metrics based on model type
      const performanceMetrics = this.generatePerformanceMetrics(job.config.modelType);

      // Update model record
      const updateQuery = `
        UPDATE ml_models 
        SET performance_metrics = $1, 
            deployment_status = $2,
            api_endpoint = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `;

      const apiEndpoint = `/api/ml/models/${job.modelId}/predict`;

      await database.query(updateQuery, [
        JSON.stringify(performanceMetrics),
        'production',
        apiEndpoint,
        job.modelId
      ]);

      // Update job status
      job.status = 'completed';
      job.completedAt = Date.now();
      job.performanceMetrics = performanceMetrics;

      logger.mlOperation(
        job.modelId, 
        'training_completed', 
        job.config.trainingData.maxRecords,
        1,
        job.completedAt - job.startTime
      );

      // Clean up
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600000); // Keep for 1 hour

    } catch (error) {
      logger.error('Failed to complete training:', error);
      await this.failTraining(jobId, error.message);
    }
  }

  async failTraining(jobId, errorMessage) {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) return;

      job.status = 'failed';
      job.error = errorMessage;
      job.failedAt = Date.now();

      // Update model record
      await database.query(
        'UPDATE ml_models SET deployment_status = $1 WHERE id = $2',
        ['failed', job.modelId]
      );

      logger.error('Training job failed', { jobId, error: errorMessage });

    } catch (error) {
      logger.error('Failed to mark training as failed:', error);
    }
  }

  generatePerformanceMetrics(modelType) {
    const baseMetrics = {
      trainingTime: Math.random() * 30 + 5, // 5-35 minutes
      dataPointsProcessed: Math.floor(Math.random() * 50000) + 10000,
      convergenceEpoch: Math.floor(Math.random() * 80) + 20
    };

    switch (modelType) {
      case 'sentiment_analysis':
        return {
          ...baseMetrics,
          accuracy: 0.85 + Math.random() * 0.10,
          precision: 0.82 + Math.random() * 0.12,
          recall: 0.84 + Math.random() * 0.10,
          f1Score: 0.83 + Math.random() * 0.11,
          validationLoss: 0.15 + Math.random() * 0.10,
          classificationReport: {
            positive: { precision: 0.88, recall: 0.85, f1: 0.86 },
            negative: { precision: 0.82, recall: 0.87, f1: 0.84 },
            neutral: { precision: 0.79, recall: 0.81, f1: 0.80 }
          }
        };

      case 'correlation_prediction':
        return {
          ...baseMetrics,
          pearsonCorrelation: 0.65 + Math.random() * 0.25,
          meanSquaredError: 0.05 + Math.random() * 0.10,
          rSquared: 0.60 + Math.random() * 0.30,
          meanAbsoluteError: 0.08 + Math.random() * 0.07,
          validationScore: 0.70 + Math.random() * 0.20
        };

      case 'health_outcome':
        return {
          ...baseMetrics,
          accuracy: 0.78 + Math.random() * 0.15,
          auc: 0.82 + Math.random() * 0.12,
          sensitivity: 0.75 + Math.random() * 0.18,
          specificity: 0.80 + Math.random() * 0.15,
          positivePredictiveValue: 0.77 + Math.random() * 0.16,
          negativePredictiveValue: 0.83 + Math.random() * 0.12
        };

      case 'relationship_dynamics':
        return {
          ...baseMetrics,
          accuracy: 0.73 + Math.random() * 0.20,
          balancedAccuracy: 0.71 + Math.random() * 0.22,
          macroF1: 0.69 + Math.random() * 0.24,
          microF1: 0.72 + Math.random() * 0.21,
          cohensKappa: 0.55 + Math.random() * 0.30
        };

      case 'intervention_timing':
        return {
          ...baseMetrics,
          meanAbsoluteError: 2.5 + Math.random() * 3.0, // days
          rootMeanSquaredError: 3.8 + Math.random() * 4.2,
          meanAbsolutePercentageError: 15 + Math.random() * 20,
          rSquared: 0.55 + Math.random() * 0.35,
          temporalAccuracy: 0.68 + Math.random() * 0.25
        };

      default:
        return baseMetrics;
    }
  }

  async getTrainingProgress(jobId) {
    try {
      // Check active jobs first
      const activeJob = this.activeJobs.get(jobId);
      if (activeJob) {
        return {
          jobId,
          status: activeJob.status,
          progress: activeJob.progress,
          currentStep: activeJob.currentStep,
          startTime: activeJob.startTime,
          estimatedCompletion: activeJob.estimatedCompletion,
          ...(activeJob.error && { error: activeJob.error }),
          ...(activeJob.performanceMetrics && { performanceMetrics: activeJob.performanceMetrics })
        };
      }

      // Check Redis cache
      const cached = await redis.client?.get(`training_progress:${jobId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      return null;

    } catch (error) {
      logger.error('Failed to get training progress:', error);
      return null;
    }
  }

  async predict(model, input, options = {}) {
    const startTime = Date.now();
    
    try {
      const { includeConfidence = true, includeExplanation = false } = options;
      
      logger.info('Making ML prediction', {
        modelId: model.id,
        modelType: model.model_type,
        inputType: typeof input
      });

      // Simulate prediction based on model type
      const prediction = this.simulatePrediction(model, input);
      
      const result = {
        prediction: prediction.value,
        ...(includeConfidence && { confidence: prediction.confidence }),
        ...(includeExplanation && { explanation: prediction.explanation }),
        processingTime: Date.now() - startTime
      };

      return result;

    } catch (error) {
      logger.error('Prediction failed:', error);
      throw new Error('Failed to make prediction');
    }
  }

  simulatePrediction(model, input) {
    switch (model.model_type) {
      case 'sentiment_analysis':
        if (typeof input === 'string') {
          const score = -1 + Math.random() * 2; // -1 to 1
          const category = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
          
          return {
            value: {
              score: Math.round(score * 100) / 100,
              category,
              emotions: {
                joy: Math.max(0, score * 0.7 + Math.random() * 0.3),
                sadness: Math.max(0, -score * 0.6 + Math.random() * 0.2),
                confidence: Math.max(0, Math.random() * 0.5)
              }
            },
            confidence: 0.75 + Math.random() * 0.20,
            explanation: `Predicted ${category} sentiment based on linguistic patterns and emotional indicators`
          };
        }
        break;

      case 'correlation_prediction':
        return {
          value: {
            correlationCoefficient: -0.5 + Math.random(),
            significance: Math.random() < 0.3 ? 'high' : Math.random() < 0.6 ? 'medium' : 'low',
            timeframe: '30 days',
            variables: ['sentiment_score', 'engagement_level']
          },
          confidence: 0.65 + Math.random() * 0.25,
          explanation: 'Correlation prediction based on historical data patterns'
        };

      case 'health_outcome':
        return {
          value: {
            riskScore: Math.random(),
            category: Math.random() > 0.7 ? 'high_risk' : Math.random() > 0.3 ? 'medium_risk' : 'low_risk',
            timeHorizon: 30,
            factors: ['sentiment_trend', 'engagement_pattern', 'social_support']
          },
          confidence: 0.70 + Math.random() * 0.25,
          explanation: 'Health outcome prediction based on behavioral and sentiment patterns'
        };

      case 'relationship_dynamics':
        return {
          value: {
            stabilityScore: Math.random(),
            trend: Math.random() > 0.5 ? 'improving' : 'declining',
            keyFactors: ['communication_quality', 'emotional_support', 'conflict_resolution'],
            recommendations: ['Increase communication frequency', 'Focus on emotional validation']
          },
          confidence: 0.68 + Math.random() * 0.27,
          explanation: 'Relationship dynamics assessment based on communication patterns and sentiment analysis'
        };

      case 'intervention_timing':
        const daysToIntervention = Math.floor(Math.random() * 14) + 1;
        return {
          value: {
            optimalTiming: daysToIntervention,
            urgency: daysToIntervention <= 3 ? 'high' : daysToIntervention <= 7 ? 'medium' : 'low',
            interventionType: ['therapeutic', 'preventive', 'supportive'][Math.floor(Math.random() * 3)],
            triggerEvents: ['sentiment_decline', 'engagement_drop', 'conflict_increase']
          },
          confidence: 0.72 + Math.random() * 0.23,
          explanation: `Optimal intervention timing predicted based on trend analysis and risk factors`
        };

      default:
        return {
          value: { result: 'Model type not supported for prediction simulation' },
          confidence: 0.5,
          explanation: 'Generic prediction placeholder'
        };
    }
  }

  async predictHealthOutcomes(config) {
    const {
      userData,
      timeHorizon,
      outcomeTypes,
      includeProbabilities,
      includeRecommendations
    } = config;

    const predictions = {};

    for (const outcomeType of outcomeTypes) {
      const prediction = this.simulateHealthOutcomePrediction(
        outcomeType,
        userData,
        timeHorizon
      );

      predictions[outcomeType] = {
        prediction: prediction.value,
        ...(includeProbabilities && { probability: prediction.probability }),
        ...(includeRecommendations && { recommendations: prediction.recommendations }),
        confidence: prediction.confidence,
        dataPointsUsed: userData.length
      };
    }

    return {
      predictions,
      timeHorizon,
      analysisDate: new Date().toISOString(),
      dataQuality: this.assessDataQuality(userData)
    };
  }

  simulateHealthOutcomePrediction(outcomeType, userData, timeHorizon) {
    const avgSentiment = userData.reduce((sum, d) => sum + d.sentiment_score, 0) / userData.length;
    const sentimentTrend = this.calculateTrend(userData.map(d => d.sentiment_score));
    
    switch (outcomeType) {
      case 'relationship_stability':
        const stabilityScore = Math.max(0, Math.min(1, avgSentiment * 0.5 + 0.5 + sentimentTrend * 0.3));
        return {
          value: {
            stabilityScore,
            riskLevel: stabilityScore > 0.7 ? 'low' : stabilityScore > 0.4 ? 'medium' : 'high',
            keyFactors: ['sentiment_trend', 'communication_frequency', 'conflict_patterns']
          },
          probability: stabilityScore,
          confidence: 0.75 + Math.random() * 0.20,
          recommendations: this.generateRelationshipRecommendations(stabilityScore)
        };

      case 'mental_health_trend':
        const mentalHealthScore = Math.max(0, Math.min(1, avgSentiment * 0.6 + 0.4 + sentimentTrend * 0.4));
        return {
          value: {
            trendDirection: sentimentTrend > 0.1 ? 'improving' : sentimentTrend < -0.1 ? 'declining' : 'stable',
            severityRisk: mentalHealthScore < 0.3 ? 'high' : mentalHealthScore < 0.6 ? 'moderate' : 'low',
            indicators: ['mood_patterns', 'activity_level', 'social_engagement']
          },
          probability: 1 - mentalHealthScore,
          confidence: 0.70 + Math.random() * 0.25,
          recommendations: this.generateMentalHealthRecommendations(mentalHealthScore)
        };

      case 'intervention_timing':
        const urgencyScore = Math.max(0, 1 - avgSentiment - sentimentTrend);
        const daysToIntervention = Math.max(1, Math.floor(urgencyScore * timeHorizon));
        return {
          value: {
            recommendedDays: daysToIntervention,
            urgencyLevel: daysToIntervention <= 3 ? 'immediate' : daysToIntervention <= 7 ? 'soon' : 'routine',
            interventionType: urgencyScore > 0.7 ? 'crisis' : urgencyScore > 0.4 ? 'therapeutic' : 'preventive'
          },
          probability: urgencyScore,
          confidence: 0.68 + Math.random() * 0.27,
          recommendations: this.generateInterventionRecommendations(urgencyScore)
        };

      default:
        return {
          value: { message: 'Outcome type not supported' },
          probability: 0.5,
          confidence: 0.5,
          recommendations: []
        };
    }
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope || 0;
  }

  generateRelationshipRecommendations(score) {
    if (score > 0.7) {
      return [
        'Continue current positive communication patterns',
        'Consider relationship enrichment activities',
        'Maintain regular check-ins about relationship satisfaction'
      ];
    } else if (score > 0.4) {
      return [
        'Focus on improving communication quality',
        'Schedule regular relationship discussions',
        'Consider couples activities to strengthen bond',
        'Address any recurring conflict patterns'
      ];
    } else {
      return [
        'Seek professional relationship counseling',
        'Prioritize conflict resolution skills',
        'Increase emotional support and validation',
        'Consider temporary space if needed for reflection'
      ];
    }
  }

  generateMentalHealthRecommendations(score) {
    if (score > 0.7) {
      return [
        'Maintain current positive coping strategies',
        'Continue regular self-care practices',
        'Stay connected with support network'
      ];
    } else if (score > 0.4) {
      return [
        'Increase physical activity and exercise',
        'Practice stress management techniques',
        'Ensure adequate sleep and nutrition',
        'Consider mindfulness or meditation practices'
      ];
    } else {
      return [
        'Seek professional mental health support',
        'Consider therapy or counseling',
        'Reach out to trusted friends or family',
        'Evaluate medication options with healthcare provider'
      ];
    }
  }

  generateInterventionRecommendations(urgency) {
    if (urgency > 0.7) {
      return [
        'Immediate professional intervention recommended',
        'Contact crisis hotline if needed',
        'Ensure safety and support system activation',
        'Consider emergency services if at risk'
      ];
    } else if (urgency > 0.4) {
      return [
        'Schedule appointment with therapist within week',
        'Increase monitoring and check-ins',
        'Implement immediate coping strategies',
        'Alert support network to provide assistance'
      ];
    } else {
      return [
        'Consider preventive therapy or counseling',
        'Maintain regular monitoring and self-care',
        'Continue positive coping strategies',
        'Schedule routine mental health check-up'
      ];
    }
  }

  assessDataQuality(userData) {
    const uniqueDays = new Set(userData.map(d => d.created_at.toDateString())).size;
    const totalDays = Math.ceil((new Date() - new Date(userData[userData.length - 1].created_at)) / (1000 * 60 * 60 * 24));
    const coverage = uniqueDays / totalDays;
    
    return {
      dataPoints: userData.length,
      uniqueDays,
      coverage: Math.round(coverage * 100),
      quality: coverage > 0.7 ? 'high' : coverage > 0.4 ? 'medium' : 'low'
    };
  }

  async startFederatedTraining(config) {
    const jobId = crypto.randomUUID();
    
    try {
      const {
        modelType,
        participatingApps,
        aggregationMethod,
        privacyLevel,
        rounds,
        clientId
      } = config;

      logger.info('Starting federated learning job', {
        jobId,
        modelType,
        participatingApps,
        rounds
      });

      const federatedJob = {
        id: jobId,
        status: 'initializing',
        progress: 0,
        currentRound: 0,
        totalRounds: rounds,
        participatingApps,
        startTime: Date.now(),
        estimatedCompletion: new Date(Date.now() + rounds * 10 * 60 * 1000), // 10 min per round
        config
      };

      this.federatedJobs.set(jobId, federatedJob);

      // Simulate federated training
      this.simulateFederatedTraining(jobId, federatedJob);

      return {
        id: jobId,
        estimatedCompletion: federatedJob.estimatedCompletion
      };

    } catch (error) {
      logger.error('Failed to start federated training:', error);
      throw error;
    }
  }

  async simulateFederatedTraining(jobId, job) {
    try {
      const roundInterval = setInterval(async () => {
        if (job.currentRound >= job.totalRounds) {
          clearInterval(roundInterval);
          await this.completeFederatedTraining(jobId, job);
          return;
        }

        job.currentRound++;
        job.progress = job.currentRound / job.totalRounds;
        job.status = `round_${job.currentRound}`;

        logger.info('Federated training round progress', {
          jobId,
          round: job.currentRound,
          totalRounds: job.totalRounds
        });

        // Cache progress
        await redis.client?.setex(
          `federated_progress:${jobId}`,
          3600,
          JSON.stringify({
            progress: job.progress,
            currentRound: job.currentRound,
            totalRounds: job.totalRounds,
            status: job.status
          })
        );

      }, 10000); // 10 seconds per simulated round

    } catch (error) {
      logger.error('Federated training simulation error:', error);
    }
  }

  async completeFederatedTraining(jobId, job) {
    try {
      job.status = 'completed';
      job.completedAt = Date.now();
      
      logger.info('Federated training completed', { jobId });

      // Clean up after 1 hour
      setTimeout(() => {
        this.federatedJobs.delete(jobId);
      }, 3600000);

    } catch (error) {
      logger.error('Failed to complete federated training:', error);
    }
  }

  async getFederatedProgress(jobId) {
    try {
      const activeJob = this.federatedJobs.get(jobId);
      if (activeJob) {
        return {
          jobId,
          status: activeJob.status,
          progress: activeJob.progress,
          currentRound: activeJob.currentRound,
          totalRounds: activeJob.totalRounds,
          participatingApps: activeJob.participatingApps,
          startTime: activeJob.startTime,
          estimatedCompletion: activeJob.estimatedCompletion
        };
      }

      const cached = await redis.client?.get(`federated_progress:${jobId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      return null;

    } catch (error) {
      logger.error('Failed to get federated progress:', error);
      return null;
    }
  }

  async getModelAnalytics(modelId, timeframe) {
    try {
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      // Get usage analytics from API usage table
      const usageQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as prediction_count,
          AVG(response_time_ms) as avg_response_time,
          SUM(data_points_processed) as total_data_points
        FROM api_usage 
        WHERE endpoint LIKE '%/predict%' 
        AND created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      const usageResult = await database.query(usageQuery, [startDate]);

      // Get model information
      const modelQuery = `
        SELECT model_name, model_type, performance_metrics, created_at
        FROM ml_models 
        WHERE id = $1
      `;

      const modelResult = await database.query(modelQuery, [modelId]);

      if (modelResult.rows.length === 0) {
        throw new Error('Model not found');
      }

      const model = modelResult.rows[0];

      return {
        model: {
          name: model.model_name,
          type: model.model_type,
          createdAt: model.created_at,
          performanceMetrics: typeof model.performance_metrics === 'string' 
            ? JSON.parse(model.performance_metrics) 
            : model.performance_metrics
        },
        usage: {
          timeframe,
          totalPredictions: usageResult.rows.reduce((sum, row) => sum + parseInt(row.prediction_count), 0),
          avgResponseTime: usageResult.rows.length > 0 
            ? usageResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_response_time), 0) / usageResult.rows.length 
            : 0,
          dailyUsage: usageResult.rows
        }
      };

    } catch (error) {
      logger.error('Failed to get model analytics:', error);
      throw error;
    }
  }

  generateInputHash(input) {
    const inputString = typeof input === 'string' ? input : JSON.stringify(input);
    return crypto.createHash('sha256').update(inputString).digest('hex').substring(0, 16);
  }
}

module.exports = new MLTrainingService();