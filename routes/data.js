const express = require('express');
const router = express.Router();
const Joi = require('joi');
const database = require('../utils/database');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const sentimentService = require('../services/sentimentAnalysis');
const anonymizationService = require('../services/anonymization');

// Validation schemas
const singleDataPointSchema = Joi.object({
  appName: Joi.string().required().min(1).max(100),
  userId: Joi.string().uuid().required(),
  textContent: Joi.string().required().min(1).max(10000),
  contextMetadata: Joi.object().optional(),
  anonymize: Joi.boolean().default(true)
});

const batchDataSchema = Joi.object({
  appName: Joi.string().required().min(1).max(100),
  dataPoints: Joi.array().items(Joi.object({
    userId: Joi.string().uuid().required(),
    textContent: Joi.string().required().min(1).max(10000),
    contextMetadata: Joi.object().optional()
  })).max(100), // Max 100 items per batch
  anonymize: Joi.boolean().default(true)
});

// Single data point ingestion
router.post('/ingest', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = singleDataPointSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { appName, userId, textContent, contextMetadata, anonymize } = value;
    
    // Perform sentiment analysis
    const sentimentResult = await sentimentService.analyzeSentiment(textContent);
    
    // Anonymize content if requested
    let anonymizedContent = null;
    if (anonymize) {
      anonymizedContent = await anonymizationService.anonymizeText(textContent, 'basic');
    }

    // Store in database
    const query = `
      INSERT INTO sentiment_data (
        app_name, user_id, sentiment_score, sentiment_category,
        text_content, emotional_indicators, context_metadata, anonymized_content
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, sentiment_score, sentiment_category, created_at
    `;
    
    const values = [
      appName,
      userId,
      sentimentResult.score,
      sentimentResult.category,
      textContent,
      JSON.stringify(sentimentResult.emotions),
      JSON.stringify(contextMetadata || {}),
      anonymizedContent
    ];

    const result = await database.query(query, values);
    const insertedRecord = result.rows[0];

    // Cache result for potential reuse
    const cacheKey = `${appName}:${userId}:${Date.now()}`;
    await redis.cacheSentimentResult(cacheKey, sentimentResult, 3600);

    const responseTime = Date.now() - startTime;
    
    logger.info('Data ingestion completed', {
      appName,
      userId: userId.substring(0, 8) + '...',
      sentimentScore: sentimentResult.score,
      responseTime
    });

    res.json({
      success: true,
      id: insertedRecord.id,
      sentiment: {
        score: sentimentResult.score,
        category: sentimentResult.category,
        emotions: sentimentResult.emotions
      },
      processingTime: responseTime,
      timestamp: insertedRecord.created_at
    });

  } catch (error) {
    logger.error('Data ingestion error:', error);
    res.status(500).json({
      error: 'Failed to process data',
      message: 'Internal server error'
    });
  }
});

// Batch data ingestion
router.post('/ingest/batch', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = batchDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { appName, dataPoints, anonymize } = value;
    const results = [];
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Starting batch processing', {
      appName,
      batchId,
      itemCount: dataPoints.length
    });

    // Process each data point
    for (const dataPoint of dataPoints) {
      try {
        const { userId, textContent, contextMetadata } = dataPoint;
        
        // Perform sentiment analysis
        const sentimentResult = await sentimentService.analyzeSentiment(textContent);
        
        // Anonymize content if requested
        let anonymizedContent = null;
        if (anonymize) {
          anonymizedContent = await anonymizationService.anonymizeText(textContent, 'basic');
        }

        // Store in database
        const query = `
          INSERT INTO sentiment_data (
            app_name, user_id, sentiment_score, sentiment_category,
            text_content, emotional_indicators, context_metadata, anonymized_content
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, sentiment_score, sentiment_category, created_at
        `;
        
        const values = [
          appName,
          userId,
          sentimentResult.score,
          sentimentResult.category,
          textContent,
          JSON.stringify(sentimentResult.emotions),
          JSON.stringify(contextMetadata || {}),
          anonymizedContent
        ];

        const result = await database.query(query, values);
        const insertedRecord = result.rows[0];

        results.push({
          id: insertedRecord.id,
          userId,
          sentiment: {
            score: sentimentResult.score,
            category: sentimentResult.category,
            emotions: sentimentResult.emotions
          },
          timestamp: insertedRecord.created_at
        });

      } catch (itemError) {
        logger.error('Error processing batch item:', {
          batchId,
          userId: dataPoint.userId,
          error: itemError.message
        });
        
        results.push({
          userId: dataPoint.userId,
          error: 'Processing failed',
          details: itemError.message
        });
      }
    }

    const responseTime = Date.now() - startTime;
    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.length - successCount;

    logger.info('Batch processing completed', {
      appName,
      batchId,
      totalItems: dataPoints.length,
      successCount,
      errorCount,
      responseTime
    });

    res.json({
      success: true,
      batchId,
      results,
      summary: {
        totalItems: dataPoints.length,
        successCount,
        errorCount,
        processingTime: responseTime
      }
    });

  } catch (error) {
    logger.error('Batch ingestion error:', error);
    res.status(500).json({
      error: 'Failed to process batch',
      message: 'Internal server error'
    });
  }
});

// Get user sentiment history
router.get('/events/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      appName, 
      limit = 100, 
      offset = 0,
      startDate,
      endDate,
      sentimentCategory
    } = req.query;

    // Validation
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    let query = `
      SELECT id, app_name, sentiment_score, sentiment_category,
             emotional_indicators, context_metadata, created_at
      FROM sentiment_data 
      WHERE user_id = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // Add filters
    if (appName) {
      query += ` AND app_name = $${paramIndex}`;
      params.push(appName);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (sentimentCategory) {
      query += ` AND sentiment_category = $${paramIndex}`;
      params.push(sentimentCategory);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await database.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rowCount
      }
    });

  } catch (error) {
    logger.error('Error retrieving user events:', error);
    res.status(500).json({
      error: 'Failed to retrieve events',
      message: 'Internal server error'
    });
  }
});

// Get aggregated statistics
router.get('/stats', async (req, res) => {
  try {
    const { appName, timeframe = '7d' } = req.query;
    
    // Calculate date range based on timeframe
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
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    let query = `
      SELECT 
        app_name,
        COUNT(*) as total_records,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(CASE WHEN sentiment_category = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_category = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN sentiment_category = 'neutral' THEN 1 END) as neutral_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM sentiment_data 
      WHERE created_at >= $1
    `;
    
    const params = [startDate];

    if (appName) {
      query += ` AND app_name = $2`;
      params.push(appName);
    }

    query += ` GROUP BY app_name ORDER BY total_records DESC`;

    const result = await database.query(query, params);

    res.json({
      success: true,
      timeframe,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      stats: result.rows
    });

  } catch (error) {
    logger.error('Error retrieving stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;