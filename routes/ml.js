const express = require('express');
const router = express.Router();
const Joi = require('joi');
const database = require('../utils/database');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const mlService = require('../services/mlTraining');
const correlationEngine = require('../services/correlationEngine');
const authMiddleware = require('../middleware/auth');

// Apply usage tracking
router.use(authMiddleware.trackUsage);

// Validation schemas
const trainingRequestSchema = Joi.object({
  modelName: Joi.string().min(1).max(255).required(),
  modelType: Joi.string().valid(
    'sentiment_analysis', 
    'correlation_prediction', 
    'health_outcome', 
    'relationship_dynamics',
    'intervention_timing'
  ).required(),
  trainingData: Joi.object({
    appNames: Joi.array().items(Joi.string()).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    maxRecords: Joi.number().min(1000).max(100000).default(10000),
    testSplitRatio: Joi.number().min(0.1).max(0.5).default(0.2)
  }).required(),
  hyperparameters: Joi.object().optional(),
  trainingOptions: Joi.object({
    epochs: Joi.number().min(1).max(1000).default(100),
    batchSize: Joi.number().min(16).max(512).default(32),
    learningRate: Joi.number().min(0.0001).max(0.1).default(0.001),
    validationSplit: Joi.number().min(0.1).max(0.3).default(0.2)
  }).optional()
});

const predictionRequestSchema = Joi.object({
  modelId: Joi.string().uuid().required(),
  input: Joi.alternatives().try(
    Joi.string().min(1).max(10000), // Text input
    Joi.object(), // Structured input
    Joi.array().items(Joi.object()) // Batch input
  ).required(),
  includeConfidence: Joi.boolean().default(true),
  includeExplanation: Joi.boolean().default(false)
});

// Get available ML models
router.get('/models', authMiddleware.checkEndpointPermission('ml_access'), async (req, res) => {
  try {
    const { modelType, deploymentStatus = 'production' } = req.query;

    let query = `
      SELECT id, model_name, model_type, performance_metrics,
             version, deployment_status, api_endpoint, created_at, updated_at
      FROM ml_models 
      WHERE deployment_status = $1
    `;

    const params = [deploymentStatus];

    if (modelType) {
      query += ` AND model_type = $2`;
      params.push(modelType);
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await database.query(query, params);

    res.json({
      success: true,
      models: result.rows.map(model => ({
        ...model,
        performance_metrics: typeof model.performance_metrics === 'string' 
          ? JSON.parse(model.performance_metrics) 
          : model.performance_metrics
      }))
    });

  } catch (error) {
    logger.error('Model listing error:', error);
    res.status(500).json({
      error: 'Failed to retrieve models',
      message: 'Internal server error'
    });
  }
});

// Train new ML model
router.post('/models/train', authMiddleware.checkEndpointPermission('ml_training'), async (req, res) => {
  try {
    const { error, value } = trainingRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { modelName, modelType, trainingData, hyperparameters, trainingOptions } = value;
    
    logger.info('ML model training started', {
      clientId: req.enterpriseClient.id,
      modelName,
      modelType,
      trainingData
    });

    // Check if training is already in progress for this client
    const existingQuery = `
      SELECT id FROM ml_models 
      WHERE model_name = $1 AND trained_by = $2 AND deployment_status = 'training'
    `;
    const existingResult = await database.query(existingQuery, [modelName, req.enterpriseClient.id]);
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Training in progress',
        message: 'A model with this name is already being trained'
      });
    }

    // Start training process (async)
    const trainingJob = await mlService.startTraining({
      modelName,
      modelType,
      trainingData,
      hyperparameters: hyperparameters || {},
      trainingOptions: trainingOptions || {},
      clientId: req.enterpriseClient.id
    });

    req.dataPointsProcessed = Math.ceil(trainingData.maxRecords / 100); // Training billing

    res.json({
      success: true,
      message: 'Model training started',
      trainingJob: {
        id: trainingJob.id,
        modelName,
        modelType,
        status: 'training',
        estimatedCompletionTime: trainingJob.estimatedCompletion,
        progressEndpoint: `/api/ml/training/${trainingJob.id}/progress`
      },
      billingInfo: {
        dataPointsProcessed: req.dataPointsProcessed,
        estimatedCost: req.dataPointsProcessed * 0.20 // Premium pricing for ML training
      }
    });

  } catch (error) {
    logger.error('Model training error:', error);
    res.status(500).json({
      error: 'Failed to start training',
      message: 'Internal server error'
    });
  }
});

// Get training progress
router.get('/training/:jobId/progress', authMiddleware.checkEndpointPermission('ml_access'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const progress = await mlService.getTrainingProgress(jobId);
    
    if (!progress) {
      return res.status(404).json({
        error: 'Training job not found',
        message: 'Invalid job ID or training has completed'
      });
    }

    res.json({
      success: true,
      progress
    });

  } catch (error) {
    logger.error('Training progress error:', error);
    res.status(500).json({
      error: 'Failed to get training progress',
      message: 'Internal server error'
    });
  }
});

// Make predictions with trained model
router.post('/models/predict', authMiddleware.checkEndpointPermission('ml_inference'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = predictionRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { modelId, input, includeConfidence, includeExplanation } = value;

    // Get model info
    const modelQuery = `
      SELECT * FROM ml_models 
      WHERE id = $1 AND deployment_status = 'production'
    `;
    const modelResult = await database.query(modelQuery, [modelId]);

    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Model not found',
        message: 'Model not available for inference'
      });
    }

    const model = modelResult.rows[0];

    // Check cache for repeated predictions
    const inputHash = mlService.generateInputHash(input);
    const cached = await redis.getCachedMLResult(modelId, inputHash);
    
    if (cached) {
      logger.info('ML prediction cache hit', { modelId, inputHash });
      return res.json({
        success: true,
        prediction: cached,
        cached: true,
        processingTime: Date.now() - startTime
      });
    }

    // Make prediction
    const prediction = await mlService.predict(model, input, {
      includeConfidence,
      includeExplanation
    });

    // Cache result
    await redis.cacheMLResult(modelId, inputHash, prediction, 7200);

    const responseTime = Date.now() - startTime;
    
    // Determine data points for billing
    const dataPoints = Array.isArray(input) ? input.length : 1;
    req.dataPointsProcessed = dataPoints;

    logger.mlOperation(modelId, 'prediction', dataPoints, 1, responseTime);

    res.json({
      success: true,
      prediction,
      metadata: {
        modelName: model.model_name,
        modelType: model.model_type,
        version: model.version,
        processingTime: responseTime
      },
      billingInfo: {
        dataPointsProcessed: dataPoints,
        cost: dataPoints * 0.05 // Inference pricing
      }
    });

  } catch (error) {
    logger.error('ML prediction error:', error);
    res.status(500).json({
      error: 'Prediction failed',
      message: 'Internal server error'
    });
  }
});

// Correlation analysis endpoints
router.post('/correlations/analyze', authMiddleware.checkEndpointPermission('advanced_analytics'), async (req, res) => {
  try {
    const {
      analysisType = 'cross_app_correlation',
      timeframe = '30d',
      apps,
      variables,
      minCorrelationStrength = 0.3,
      includeStatisticalTests = true
    } = req.body;

    if (!apps || apps.length < 2) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'At least 2 apps required for correlation analysis'
      });
    }

    logger.info('Correlation analysis started', {
      clientId: req.enterpriseClient.id,
      analysisType,
      apps,
      timeframe
    });

    const analysis = await correlationEngine.analyzeCorrelations({
      analysisType,
      timeframe,
      apps,
      variables: variables || ['sentiment_score', 'emotional_indicators'],
      minCorrelationStrength,
      includeStatisticalTests
    });

    req.dataPointsProcessed = analysis.dataPointsAnalyzed;

    res.json({
      success: true,
      analysis,
      billingInfo: {
        dataPointsProcessed: req.dataPointsProcessed,
        analysisComplexity: 'advanced',
        cost: req.dataPointsProcessed * 0.10
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

// Predictive analytics for health outcomes
router.post('/predictions/health-outcomes', authMiddleware.checkEndpointPermission('predictive_analytics'), async (req, res) => {
  try {
    const {
      userId,
      timeHorizon = 30, // days
      outcomeTypes = ['relationship_stability', 'mental_health_trend', 'intervention_timing'],
      includeProbabilities = true,
      includeRecommendations = true
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'User ID required for health outcome prediction'
      });
    }

    // Get user's historical data
    const userDataQuery = `
      SELECT app_name, sentiment_score, sentiment_category,
             emotional_indicators, context_metadata, created_at
      FROM sentiment_data 
      WHERE user_id = $1 
      AND created_at >= NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `;

    const userDataResult = await database.query(userDataQuery, [userId]);

    if (userDataResult.rows.length < 10) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'At least 10 data points required for prediction'
      });
    }

    // Use trained models for predictions
    const predictions = await mlService.predictHealthOutcomes({
      userData: userDataResult.rows,
      timeHorizon,
      outcomeTypes,
      includeProbabilities,
      includeRecommendations
    });

    req.dataPointsProcessed = userDataResult.rows.length;

    logger.info('Health outcome prediction completed', {
      clientId: req.enterpriseClient.id,
      userId: userId.substring(0, 8) + '...',
      outcomeTypes,
      dataPoints: userDataResult.rows.length
    });

    res.json({
      success: true,
      predictions,
      metadata: {
        dataPointsAnalyzed: userDataResult.rows.length,
        timeHorizon,
        predictionTypes: outcomeTypes
      },
      billingInfo: {
        dataPointsProcessed: req.dataPointsProcessed,
        predictionComplexity: 'advanced',
        cost: req.dataPointsProcessed * 0.15
      }
    });

  } catch (error) {
    logger.error('Health outcome prediction error:', error);
    res.status(500).json({
      error: 'Prediction failed',
      message: 'Internal server error'
    });
  }
});

// Federated learning coordination
router.post('/federated/train', authMiddleware.checkEndpointPermission('federated_learning'), async (req, res) => {
  try {
    const {
      modelType,
      participatingApps,
      aggregationMethod = 'federated_averaging',
      privacyLevel = 'differential_privacy',
      rounds = 10
    } = req.body;

    if (!participatingApps || participatingApps.length < 2) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'At least 2 apps required for federated learning'
      });
    }

    logger.info('Federated learning started', {
      clientId: req.enterpriseClient.id,
      modelType,
      participatingApps,
      rounds
    });

    // Start federated learning process
    const federatedJob = await mlService.startFederatedTraining({
      modelType,
      participatingApps,
      aggregationMethod,
      privacyLevel,
      rounds,
      clientId: req.enterpriseClient.id
    });

    req.dataPointsProcessed = participatingApps.length * rounds * 100; // Complex billing

    res.json({
      success: true,
      message: 'Federated learning started',
      federatedJob: {
        id: federatedJob.id,
        participatingApps,
        rounds,
        status: 'initializing',
        estimatedCompletionTime: federatedJob.estimatedCompletion,
        progressEndpoint: `/api/ml/federated/${federatedJob.id}/progress`
      },
      billingInfo: {
        dataPointsProcessed: req.dataPointsProcessed,
        federatedComplexity: 'enterprise',
        cost: req.dataPointsProcessed * 0.25
      }
    });

  } catch (error) {
    logger.error('Federated learning error:', error);
    res.status(500).json({
      error: 'Failed to start federated learning',
      message: 'Internal server error'
    });
  }
});

// Get federated learning progress
router.get('/federated/:jobId/progress', authMiddleware.checkEndpointPermission('federated_learning'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const progress = await mlService.getFederatedProgress(jobId);
    
    if (!progress) {
      return res.status(404).json({
        error: 'Federated job not found',
        message: 'Invalid job ID or training has completed'
      });
    }

    res.json({
      success: true,
      progress
    });

  } catch (error) {
    logger.error('Federated progress error:', error);
    res.status(500).json({
      error: 'Failed to get federated progress',
      message: 'Internal server error'
    });
  }
});

// Model performance analytics
router.get('/models/:modelId/analytics', authMiddleware.checkEndpointPermission('ml_access'), async (req, res) => {
  try {
    const { modelId } = req.params;
    const { timeframe = '30d' } = req.query;

    // Get model usage analytics
    const analytics = await mlService.getModelAnalytics(modelId, timeframe);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Model analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve model analytics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;