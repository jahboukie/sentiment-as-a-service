const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { Parser } = require('json2csv');
const database = require('../utils/database');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const anonymizationService = require('../services/anonymization');
const authMiddleware = require('../middleware/auth');

// Apply usage tracking
router.use(authMiddleware.trackUsage);

// Validation schemas
const datasetRequestSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  filters: Joi.object({
    appNames: Joi.array().items(Joi.string()).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    sentimentRange: Joi.object({
      min: Joi.number().min(-1).max(1).optional(),
      max: Joi.number().min(-1).max(1).optional()
    }).optional(),
    demographicFilters: Joi.object().optional(),
    minDataPointsPerUser: Joi.number().min(1).optional()
  }).required(),
  anonymizationLevel: Joi.string().valid('basic', 'advanced', 'differential_privacy').default('advanced'),
  maxRecords: Joi.number().min(100).max(1000000).default(10000),
  outputFormat: Joi.string().valid('json', 'csv').default('json')
});

const licenseRequestSchema = Joi.object({
  datasetId: Joi.string().uuid().required(),
  licenseType: Joi.string().valid('research', 'commercial', 'exclusive').required(),
  duration: Joi.number().min(1).max(60).required(), // months
  intendedUse: Joi.string().max(1000).required(),
  organization: Joi.string().max(255).required(),
  contactEmail: Joi.string().email().required(),
  estimatedValue: Joi.number().min(1000).optional()
});

// Browse available research datasets
router.get('/datasets', async (req, res) => {
  try {
    const { 
      status = 'available',
      anonymizationLevel,
      minRecords,
      maxRecords,
      page = 1,
      limit = 20
    } = req.query;

    let query = `
      SELECT 
        id, dataset_name, description, anonymization_level,
        data_points_count, date_range_start, date_range_end,
        demographics_summary, price_per_record, status, created_at
      FROM research_datasets 
      WHERE status = $1
    `;

    const params = [status];
    let paramIndex = 2;

    if (anonymizationLevel) {
      query += ` AND anonymization_level = $${paramIndex}`;
      params.push(anonymizationLevel);
      paramIndex++;
    }

    if (minRecords) {
      query += ` AND data_points_count >= $${paramIndex}`;
      params.push(minRecords);
      paramIndex++;
    }

    if (maxRecords) {
      query += ` AND data_points_count <= $${paramIndex}`;
      params.push(maxRecords);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await database.query(query, params);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM research_datasets WHERE status = $1`;
    const countResult = await database.query(countQuery, [status]);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      datasets: result.rows.map(dataset => ({
        ...dataset,
        demographics_summary: typeof dataset.demographics_summary === 'string' 
          ? JSON.parse(dataset.demographics_summary) 
          : dataset.demographics_summary,
        estimatedValue: dataset.data_points_count * (dataset.price_per_record || 0.10)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    logger.error('Dataset browsing error:', error);
    res.status(500).json({
      error: 'Failed to retrieve datasets',
      message: 'Internal server error'
    });
  }
});

// Get detailed dataset information
router.get('/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params;

    const query = `
      SELECT 
        rd.*,
        COUNT(dl.id) as active_licenses,
        SUM(dl.contract_value) as total_revenue
      FROM research_datasets rd
      LEFT JOIN dataset_licenses dl ON rd.id = dl.dataset_id 
        AND dl.status = 'active'
      WHERE rd.id = $1
      GROUP BY rd.id
    `;

    const result = await database.query(query, [datasetId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Dataset not found',
        message: 'The requested dataset does not exist'
      });
    }

    const dataset = result.rows[0];

    // Get sample data structure (anonymized)
    const sampleQuery = `
      SELECT sentiment_score, sentiment_category, emotional_indicators,
             context_metadata, created_at
      FROM sentiment_data 
      WHERE anonymized_content IS NOT NULL
      LIMIT 5
    `;

    const sampleResult = await database.query(sampleQuery);

    // Track dataset access
    await redis.trackDatasetAccess(datasetId, req.researcher.id);

    res.json({
      success: true,
      dataset: {
        ...dataset,
        demographics_summary: typeof dataset.demographics_summary === 'string' 
          ? JSON.parse(dataset.demographics_summary) 
          : dataset.demographics_summary,
        licensing_terms: typeof dataset.licensing_terms === 'string' 
          ? JSON.parse(dataset.licensing_terms) 
          : dataset.licensing_terms,
        activeLicenses: parseInt(dataset.active_licenses || 0),
        totalRevenue: parseFloat(dataset.total_revenue || 0)
      },
      sampleData: sampleResult.rows.map(row => ({
        sentimentScore: row.sentiment_score,
        sentimentCategory: row.sentiment_category,
        emotionalIndicators: typeof row.emotional_indicators === 'string' 
          ? JSON.parse(row.emotional_indicators) 
          : row.emotional_indicators,
        contextMetadata: typeof row.context_metadata === 'string' 
          ? JSON.parse(row.context_metadata) 
          : row.context_metadata,
        timestamp: row.created_at
      }))
    });

  } catch (error) {
    logger.error('Dataset detail error:', error);
    res.status(500).json({
      error: 'Failed to retrieve dataset details',
      message: 'Internal server error'
    });
  }
});

// Create custom research dataset
router.post('/datasets/create', async (req, res) => {
  try {
    const { error, value } = datasetRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { 
      name, 
      description, 
      filters, 
      anonymizationLevel, 
      maxRecords, 
      outputFormat 
    } = value;

    logger.info('Creating custom research dataset', {
      researcherId: req.researcher.id,
      datasetName: name,
      anonymizationLevel,
      maxRecords
    });

    // Build data query based on filters
    let dataQuery = `
      SELECT id, app_name, user_id, sentiment_score, sentiment_category,
             text_content, emotional_indicators, context_metadata, created_at
      FROM sentiment_data WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (filters.appNames && filters.appNames.length > 0) {
      dataQuery += ` AND app_name = ANY($${paramIndex})`;
      params.push(filters.appNames);
      paramIndex++;
    }

    if (filters.startDate) {
      dataQuery += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      dataQuery += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.sentimentRange) {
      if (filters.sentimentRange.min !== undefined) {
        dataQuery += ` AND sentiment_score >= $${paramIndex}`;
        params.push(filters.sentimentRange.min);
        paramIndex++;
      }
      if (filters.sentimentRange.max !== undefined) {
        dataQuery += ` AND sentiment_score <= $${paramIndex}`;
        params.push(filters.sentimentRange.max);
        paramIndex++;
      }
    }

    if (filters.minDataPointsPerUser) {
      dataQuery += ` AND user_id IN (
        SELECT user_id FROM sentiment_data 
        GROUP BY user_id 
        HAVING COUNT(*) >= $${paramIndex}
      )`;
      params.push(filters.minDataPointsPerUser);
      paramIndex++;
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT ${maxRecords}`;

    // Execute query
    const dataResult = await database.query(dataQuery, params);
    
    if (dataResult.rows.length === 0) {
      return res.status(400).json({
        error: 'No data found',
        message: 'No records match the specified filters'
      });
    }

    // Anonymize the dataset
    const anonymizedData = [];
    let processingProgress = 0;

    for (const row of dataResult.rows) {
      try {
        let anonymizedContent = null;
        if (row.text_content) {
          anonymizedContent = await anonymizationService.anonymizeText(
            row.text_content, 
            anonymizationLevel
          );
        }

        const anonymizedRow = {
          id: row.id,
          appName: row.app_name,
          sentimentScore: row.sentiment_score,
          sentimentCategory: row.sentiment_category,
          emotionalIndicators: typeof row.emotional_indicators === 'string' 
            ? JSON.parse(row.emotional_indicators) 
            : row.emotional_indicators,
          contextMetadata: typeof row.context_metadata === 'string' 
            ? JSON.parse(row.context_metadata) 
            : row.context_metadata,
          anonymizedContent,
          timestamp: row.created_at
        };

        anonymizedData.push(anonymizedRow);
        processingProgress++;

        // Log progress for large datasets
        if (processingProgress % 1000 === 0) {
          logger.info('Dataset processing progress', {
            processed: processingProgress,
            total: dataResult.rows.length,
            percentage: Math.round((processingProgress / dataResult.rows.length) * 100)
          });
        }

      } catch (anonymizationError) {
        logger.error('Row anonymization failed:', anonymizationError);
        // Skip problematic rows but continue processing
      }
    }

    // Calculate demographics summary
    const demographicsSummary = {
      totalRecords: anonymizedData.length,
      appDistribution: anonymizedData.reduce((acc, row) => {
        acc[row.appName] = (acc[row.appName] || 0) + 1;
        return acc;
      }, {}),
      sentimentDistribution: {
        positive: anonymizedData.filter(r => r.sentimentCategory === 'positive').length,
        negative: anonymizedData.filter(r => r.sentimentCategory === 'negative').length,
        neutral: anonymizedData.filter(r => r.sentimentCategory === 'neutral').length
      },
      dateRange: {
        start: Math.min(...anonymizedData.map(r => new Date(r.timestamp))),
        end: Math.max(...anonymizedData.map(r => new Date(r.timestamp)))
      }
    };

    // Store dataset metadata
    const datasetId = require('crypto').randomUUID();
    const datasetQuery = `
      INSERT INTO research_datasets (
        id, dataset_name, description, anonymization_level,
        data_points_count, date_range_start, date_range_end,
        demographics_summary, price_per_record, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const datasetValues = [
      datasetId,
      name,
      description || 'Custom research dataset',
      anonymizationLevel,
      anonymizedData.length,
      filters.startDate || demographicsSummary.dateRange.start,
      filters.endDate || demographicsSummary.dateRange.end,
      JSON.stringify(demographicsSummary),
      0.10, // Default price per record
      'available'
    ];

    const datasetResult = await database.query(datasetQuery, datasetValues);
    const dataset = datasetResult.rows[0];

    // Prepare response based on output format
    let responseData;
    if (outputFormat === 'csv') {
      const parser = new Parser({
        fields: [
          'id', 'appName', 'sentimentScore', 'sentimentCategory',
          'anonymizedContent', 'timestamp'
        ]
      });
      responseData = parser.parse(anonymizedData);
    } else {
      responseData = anonymizedData;
    }

    req.dataPointsProcessed = anonymizedData.length; // For billing

    logger.datasetAccess(datasetId, req.researcher.id, anonymizedData.length, anonymizationLevel);

    res.json({
      success: true,
      dataset: {
        ...dataset,
        demographics_summary: demographicsSummary
      },
      data: responseData,
      metadata: {
        totalRecords: anonymizedData.length,
        anonymizationLevel,
        outputFormat,
        processingTime: Date.now() - Date.now()
      }
    });

  } catch (error) {
    logger.error('Dataset creation error:', error);
    res.status(500).json({
      error: 'Failed to create dataset',
      message: 'Internal server error'
    });
  }
});

// Request dataset license
router.post('/datasets/:datasetId/license', async (req, res) => {
  try {
    const { datasetId } = req.params;
    const { error, value } = licenseRequestSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { 
      licenseType, 
      duration, 
      intendedUse, 
      organization, 
      contactEmail,
      estimatedValue 
    } = value;

    // Verify dataset exists
    const datasetQuery = `
      SELECT * FROM research_datasets WHERE id = $1 AND status = 'available'
    `;
    const datasetResult = await database.query(datasetQuery, [datasetId]);

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Dataset not found',
        message: 'Dataset not available for licensing'
      });
    }

    const dataset = datasetResult.rows[0];

    // Calculate license value
    const basePrice = dataset.price_per_record || 0.10;
    const multiplier = licenseType === 'exclusive' ? 5.0 : 
                     licenseType === 'commercial' ? 2.0 : 1.0;
    const calculatedValue = dataset.data_points_count * basePrice * multiplier * (duration / 12);

    // Create license request
    const licenseId = require('crypto').randomUUID();
    const licenseQuery = `
      INSERT INTO dataset_licenses (
        id, dataset_id, licensee_company, license_type,
        contract_value, duration_months, data_points_licensed,
        usage_restrictions, contract_metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const usageRestrictions = {
      licenseType,
      intendedUse,
      maxUsers: licenseType === 'exclusive' ? 'unlimited' : 10,
      redistributionAllowed: licenseType === 'research' ? false : true,
      commercialUse: licenseType !== 'research',
      publicationRights: true
    };

    const contractMetadata = {
      requester: {
        organization,
        contactEmail,
        researcherId: req.researcher.id
      },
      requestDate: new Date().toISOString(),
      estimatedValue: estimatedValue || calculatedValue,
      datasetMetadata: {
        anonymizationLevel: dataset.anonymization_level,
        dataPoints: dataset.data_points_count,
        dateRange: {
          start: dataset.date_range_start,
          end: dataset.date_range_end
        }
      }
    };

    const licenseValues = [
      licenseId,
      datasetId,
      organization,
      licenseType,
      calculatedValue,
      duration,
      dataset.data_points_count,
      JSON.stringify(usageRestrictions),
      JSON.stringify(contractMetadata),
      'pending' // Will be reviewed and approved
    ];

    const licenseResult = await database.query(licenseQuery, licenseValues);
    const license = licenseResult.rows[0];

    logger.info('Dataset license requested', {
      licenseId,
      datasetId,
      organization,
      licenseType,
      value: calculatedValue,
      researcherId: req.researcher.id
    });

    res.json({
      success: true,
      message: 'License request submitted successfully',
      license: {
        ...license,
        usage_restrictions: usageRestrictions,
        contract_metadata: contractMetadata,
        estimatedProcessingTime: '2-5 business days'
      }
    });

  } catch (error) {
    logger.error('License request error:', error);
    res.status(500).json({
      error: 'Failed to submit license request',
      message: 'Internal server error'
    });
  }
});

// Get licensing analytics for researchers
router.get('/analytics/licensing', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get licensing statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT rd.id) as available_datasets,
        COUNT(DISTINCT dl.id) as total_licenses,
        COUNT(DISTINCT dl.id) FILTER (WHERE dl.status = 'active') as active_licenses,
        COUNT(DISTINCT dl.id) FILTER (WHERE dl.status = 'pending') as pending_licenses,
        SUM(dl.contract_value) FILTER (WHERE dl.status = 'active') as total_revenue,
        AVG(dl.contract_value) FILTER (WHERE dl.status = 'active') as avg_license_value
      FROM research_datasets rd
      LEFT JOIN dataset_licenses dl ON rd.id = dl.dataset_id
        AND dl.created_at >= $1
      WHERE rd.status = 'available'
    `;

    const statsResult = await database.query(statsQuery, [startDate]);
    const stats = statsResult.rows[0];

    // Get trending datasets
    const trendingQuery = `
      SELECT 
        rd.id,
        rd.dataset_name,
        rd.data_points_count,
        rd.anonymization_level,
        COUNT(dl.id) as license_requests,
        SUM(dl.contract_value) as total_value
      FROM research_datasets rd
      LEFT JOIN dataset_licenses dl ON rd.id = dl.dataset_id
        AND dl.created_at >= $1
      WHERE rd.status = 'available'
      GROUP BY rd.id, rd.dataset_name, rd.data_points_count, rd.anonymization_level
      ORDER BY license_requests DESC, total_value DESC
      LIMIT 10
    `;

    const trendingResult = await database.query(trendingQuery, [startDate]);

    res.json({
      success: true,
      timeframe,
      overview: {
        availableDatasets: parseInt(stats.available_datasets || 0),
        totalLicenses: parseInt(stats.total_licenses || 0),
        activeLicenses: parseInt(stats.active_licenses || 0),
        pendingLicenses: parseInt(stats.pending_licenses || 0),
        totalRevenue: parseFloat(stats.total_revenue || 0),
        avgLicenseValue: parseFloat(stats.avg_license_value || 0)
      },
      trendingDatasets: trendingResult.rows.map(row => ({
        id: row.id,
        name: row.dataset_name,
        dataPoints: parseInt(row.data_points_count),
        anonymizationLevel: row.anonymization_level,
        licenseRequests: parseInt(row.license_requests || 0),
        totalValue: parseFloat(row.total_value || 0)
      }))
    });

  } catch (error) {
    logger.error('Licensing analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve licensing analytics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;