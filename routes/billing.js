const express = require('express');
const router = express.Router();
const Joi = require('joi');
const database = require('../utils/database');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

// Apply usage tracking to all billing routes
router.use(authMiddleware.trackUsage);

// Get current usage and billing information
router.get('/usage', async (req, res) => {
  try {
    const clientId = req.enterpriseClient.id;
    const { period = '30d' } = req.query;

    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get detailed usage breakdown
    const usageQuery = `
      SELECT 
        endpoint,
        COUNT(*) as request_count,
        SUM(data_points_processed) as total_data_points,
        SUM(billing_amount) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        DATE(created_at) as usage_date
      FROM api_usage 
      WHERE api_key_id = $1 AND created_at >= $2
      GROUP BY endpoint, DATE(created_at)
      ORDER BY usage_date DESC, request_count DESC
    `;

    const usageResult = await database.query(usageQuery, [clientId, startDate]);

    // Get current billing cycle information
    const billingQuery = `
      SELECT 
        tier,
        rate_limit_per_minute,
        monthly_quota,
        current_usage,
        billing_plan
      FROM enterprise_clients 
      WHERE id = $1
    `;

    const billingResult = await database.query(billingQuery, [clientId]);
    const client = billingResult.rows[0];

    // Calculate usage summary
    const usageSummary = usageResult.rows.reduce((acc, row) => {
      acc.totalRequests += parseInt(row.request_count);
      acc.totalDataPoints += parseInt(row.total_data_points);
      acc.totalCost += parseFloat(row.total_cost || 0);
      return acc;
    }, { totalRequests: 0, totalDataPoints: 0, totalCost: 0 });

    // Group usage by endpoint
    const endpointUsage = {};
    usageResult.rows.forEach(row => {
      if (!endpointUsage[row.endpoint]) {
        endpointUsage[row.endpoint] = {
          requests: 0,
          dataPoints: 0,
          cost: 0,
          avgResponseTime: 0
        };
      }
      endpointUsage[row.endpoint].requests += parseInt(row.request_count);
      endpointUsage[row.endpoint].dataPoints += parseInt(row.total_data_points);
      endpointUsage[row.endpoint].cost += parseFloat(row.total_cost || 0);
      endpointUsage[row.endpoint].avgResponseTime = parseFloat(row.avg_response_time || 0);
    });

    // Get Redis usage data for current month
    const redisUsage = await redis.getAPIUsage(req.apiKey, 30);

    res.json({
      success: true,
      period,
      billingCycle: {
        tier: client.tier,
        monthlyQuota: parseInt(client.monthly_quota),
        currentUsage: parseInt(client.current_usage),
        remainingQuota: parseInt(client.monthly_quota) - parseInt(client.current_usage),
        usagePercentage: Math.round((parseInt(client.current_usage) / parseInt(client.monthly_quota)) * 100),
        rateLimitPerMinute: parseInt(client.rate_limit_per_minute)
      },
      usageSummary,
      endpointBreakdown: Object.entries(endpointUsage).map(([endpoint, data]) => ({
        endpoint,
        ...data,
        avgResponseTime: parseFloat(data.avgResponseTime).toFixed(2) + 'ms'
      })),
      dailyUsage: redisUsage,
      costBreakdown: {
        dataProcessing: usageSummary.totalCost * 0.6, // Rough breakdown
        mlInference: usageSummary.totalCost * 0.3,
        analytics: usageSummary.totalCost * 0.1
      },
      nextBillingDate: this.calculateNextBillingDate(),
      estimatedMonthlyBill: this.estimateMonthlyBill(usageSummary, client)
    });

  } catch (error) {
    logger.error('Usage billing error:', error);
    res.status(500).json({
      error: 'Failed to retrieve usage information',
      message: 'Internal server error'
    });
  }
});

// Get billing history
router.get('/history', async (req, res) => {
  try {
    const clientId = req.enterpriseClient.id;
    const { limit = 12 } = req.query; // Default to 12 months

    // Get monthly billing summaries
    const historyQuery = `
      SELECT 
        DATE_TRUNC('month', created_at) as billing_month,
        COUNT(*) as total_requests,
        SUM(data_points_processed) as total_data_points,
        SUM(billing_amount) as monthly_cost,
        AVG(response_time_ms) as avg_response_time
      FROM api_usage 
      WHERE api_key_id = $1 
      AND created_at >= NOW() - INTERVAL '${limit} months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY billing_month DESC
    `;

    const historyResult = await database.query(historyQuery, [clientId]);

    res.json({
      success: true,
      billingHistory: historyResult.rows.map(row => ({
        month: row.billing_month,
        totalRequests: parseInt(row.total_requests),
        totalDataPoints: parseInt(row.total_data_points),
        monthlyCost: parseFloat(row.monthly_cost || 0).toFixed(2),
        avgResponseTime: parseFloat(row.avg_response_time || 0).toFixed(2) + 'ms'
      })),
      totalPeriods: historyResult.rows.length
    });

  } catch (error) {
    logger.error('Billing history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve billing history',
      message: 'Internal server error'
    });
  }
});

// Get pricing information
router.get('/pricing', async (req, res) => {
  try {
    const pricingTiers = {
      standard: {
        name: 'Standard',
        monthlyQuota: 10000,
        rateLimitPerMinute: 100,
        costPerDataPoint: 0.05,
        features: [
          'Basic sentiment analysis',
          'Standard API access',
          'Email support',
          'Monthly reporting'
        ],
        mlTraining: false,
        correlationAnalysis: false,
        federatedLearning: false
      },
      premium: {
        name: 'Premium',
        monthlyQuota: 100000,
        rateLimitPerMinute: 500,
        costPerDataPoint: 0.01,
        features: [
          'Advanced sentiment analysis',
          'Healthcare & relationship context',
          'ML model training',
          'Correlation analysis',
          'Priority support',
          'Custom reporting',
          'Real-time monitoring'
        ],
        mlTraining: true,
        correlationAnalysis: true,
        federatedLearning: false
      },
      enterprise: {
        name: 'Enterprise',
        monthlyQuota: 1000000,
        rateLimitPerMinute: 2000,
        costPerDataPoint: 0.005,
        features: [
          'Full platform access',
          'Federated learning',
          'Custom ML models',
          'White-label APIs',
          'Dedicated support',
          'SLA guarantees',
          'Custom integrations',
          'Research dataset access'
        ],
        mlTraining: true,
        correlationAnalysis: true,
        federatedLearning: true
      }
    };

    const additionalServices = {
      mlTraining: {
        description: 'Custom ML model training',
        pricing: '$0.20 per data point processed',
        minimumEngagement: '$500'
      },
      correlationAnalysis: {
        description: 'Advanced correlation analysis',
        pricing: '$0.10 per data point analyzed',
        minimumEngagement: '$100'
      },
      researchDatasets: {
        description: 'Access to research-grade datasets',
        pricing: '$0.10 per record',
        customLicensing: 'Available for large-scale research'
      },
      consultingServices: {
        description: 'Data science consulting',
        pricing: '$300 per hour',
        minimumEngagement: '10 hours'
      }
    };

    res.json({
      success: true,
      pricingTiers,
      additionalServices,
      notes: [
        'All prices are in USD',
        'Volume discounts available for enterprise clients',
        'Custom pricing available for research institutions',
        'Academic discounts available with verification'
      ],
      contactForCustomPricing: 'enterprise@sentimentasaservice.com'
    });

  } catch (error) {
    logger.error('Pricing information error:', error);
    res.status(500).json({
      error: 'Failed to retrieve pricing information',
      message: 'Internal server error'
    });
  }
});

// Request quota increase
router.post('/quota-increase', async (req, res) => {
  const requestSchema = Joi.object({
    requestedQuota: Joi.number().min(1000).required(),
    justification: Joi.string().min(10).max(1000).required(),
    urgency: Joi.string().valid('low', 'medium', 'high').default('medium')
  });

  try {
    const { error, value } = requestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { requestedQuota, justification, urgency } = value;
    const clientId = req.enterpriseClient.id;

    // Log quota increase request
    const requestId = require('crypto').randomUUID();
    
    logger.info('Quota increase requested', {
      requestId,
      clientId,
      currentQuota: req.enterpriseClient.monthly_quota,
      requestedQuota,
      urgency
    });

    // In a real implementation, this would create a support ticket
    // For now, we'll simulate the process

    res.json({
      success: true,
      message: 'Quota increase request submitted',
      requestId,
      currentQuota: req.enterpriseClient.monthly_quota,
      requestedQuota,
      status: 'pending_review',
      estimatedProcessingTime: urgency === 'high' ? '24 hours' : urgency === 'medium' ? '2-3 business days' : '5-7 business days',
      nextSteps: [
        'Our team will review your request',
        'You will receive an email with the decision',
        'If approved, quota will be updated automatically'
      ]
    });

  } catch (error) {
    logger.error('Quota increase request error:', error);
    res.status(500).json({
      error: 'Failed to submit quota increase request',
      message: 'Internal server error'
    });
  }
});

// Upgrade tier request
router.post('/upgrade-tier', async (req, res) => {
  const upgradeSchema = Joi.object({
    targetTier: Joi.string().valid('premium', 'enterprise').required(),
    billingCycle: Joi.string().valid('monthly', 'annual').default('monthly'),
    startDate: Joi.date().min('now').optional()
  });

  try {
    const { error, value } = upgradeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { targetTier, billingCycle, startDate } = value;
    const clientId = req.enterpriseClient.id;
    const currentTier = req.enterpriseClient.tier;

    if (currentTier === targetTier) {
      return res.status(400).json({
        error: 'Invalid upgrade',
        message: 'You are already on the requested tier'
      });
    }

    // Calculate pricing
    const tierPricing = this.calculateTierPricing(targetTier, billingCycle);
    
    // Log upgrade request
    const upgradeId = require('crypto').randomUUID();
    
    logger.billingEvent(clientId, tierPricing.totalCost, 'tier_upgrade_request', {
      upgradeId,
      currentTier,
      targetTier,
      billingCycle
    });

    res.json({
      success: true,
      message: 'Tier upgrade request submitted',
      upgradeId,
      currentTier,
      targetTier,
      pricing: tierPricing,
      effectiveDate: startDate || new Date().toISOString(),
      status: 'pending_approval',
      nextSteps: [
        'Payment processing will be initiated',
        'Upgrade will be applied upon successful payment',
        'You will receive confirmation email with new tier benefits'
      ]
    });

  } catch (error) {
    logger.error('Tier upgrade request error:', error);
    res.status(500).json({
      error: 'Failed to submit tier upgrade request',
      message: 'Internal server error'
    });
  }
});

// Download invoice/receipt
router.get('/invoice/:month', async (req, res) => {
  try {
    const { month } = req.params; // Format: YYYY-MM
    const clientId = req.enterpriseClient.id;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        error: 'Invalid month format',
        message: 'Month must be in YYYY-MM format'
      });
    }

    // Get invoice data for the specified month
    const invoiceQuery = `
      SELECT 
        endpoint,
        COUNT(*) as request_count,
        SUM(data_points_processed) as total_data_points,
        SUM(billing_amount) as total_cost
      FROM api_usage 
      WHERE api_key_id = $1 
      AND DATE_TRUNC('month', created_at) = $2::date
      GROUP BY endpoint
    `;

    const invoiceResult = await database.query(invoiceQuery, [clientId, month + '-01']);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Invoice not found',
        message: 'No usage data found for the specified month'
      });
    }

    const invoiceData = {
      invoiceNumber: `INV-${clientId.substr(0, 8)}-${month.replace('-', '')}`,
      month,
      client: {
        company: req.enterpriseClient.company_name,
        email: req.enterpriseClient.contact_email,
        tier: req.enterpriseClient.tier
      },
      lineItems: invoiceResult.rows.map(row => ({
        description: `API Usage - ${row.endpoint}`,
        quantity: parseInt(row.total_data_points),
        unitPrice: row.endpoint.includes('/ml/') ? 0.20 : 
                   row.endpoint.includes('/correlation/') ? 0.10 : 0.05,
        totalCost: parseFloat(row.total_cost)
      })),
      summary: {
        subtotal: invoiceResult.rows.reduce((sum, row) => sum + parseFloat(row.total_cost), 0),
        tax: 0, // Would be calculated based on jurisdiction
        total: invoiceResult.rows.reduce((sum, row) => sum + parseFloat(row.total_cost), 0)
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      invoice: invoiceData
    });

  } catch (error) {
    logger.error('Invoice generation error:', error);
    res.status(500).json({
      error: 'Failed to generate invoice',
      message: 'Internal server error'
    });
  }
});

// Helper functions
function calculateNextBillingDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

function estimateMonthlyBill(usageSummary, client) {
  const daysInMonth = 30;
  const currentDay = new Date().getDate();
  const dailyAverage = usageSummary.totalCost / Math.min(currentDay, daysInMonth);
  return (dailyAverage * daysInMonth).toFixed(2);
}

function calculateTierPricing(tier, billingCycle) {
  const basePricing = {
    premium: { monthly: 299, annual: 2990 },
    enterprise: { monthly: 1499, annual: 14990 }
  };

  const price = basePricing[tier][billingCycle];
  const discount = billingCycle === 'annual' ? 0.17 : 0; // 17% annual discount

  return {
    basePrice: price,
    discount: billingCycle === 'annual' ? price * discount : 0,
    totalCost: price - (billingCycle === 'annual' ? price * discount : 0),
    billingCycle,
    currency: 'USD'
  };
}

module.exports = router;