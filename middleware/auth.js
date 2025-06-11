const jwt = require('jsonwebtoken');
const database = require('../utils/database');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const API_KEY_HEADER = 'x-api-key';

class AuthMiddleware {
  
  // Validate enterprise API keys
  async validateEnterprise(req, res, next) {
    try {
      const apiKey = req.headers[API_KEY_HEADER];
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Enterprise API key must be provided in x-api-key header'
        });
      }

      // Check cache first
      const cachedClient = await redis.client?.get(`enterprise_client:${apiKey}`);
      let client;
      
      if (cachedClient) {
        client = JSON.parse(cachedClient);
      } else {
        // Query database for client
        const query = `
          SELECT id, company_name, contact_email, tier, rate_limit_per_minute,
                 monthly_quota, current_usage, permissions, status
          FROM enterprise_clients 
          WHERE api_key = $1 AND status = 'active'
        `;
        
        const result = await database.query(query, [apiKey]);
        
        if (result.rows.length === 0) {
          logger.securityEvent('invalid_api_key', { apiKey: apiKey.substring(0, 8) + '...' });
          return res.status(401).json({
            error: 'Invalid API key',
            message: 'API key not found or inactive'
          });
        }
        
        client = result.rows[0];
        
        // Cache for 5 minutes
        await redis.client?.setex(`enterprise_client:${apiKey}`, 300, JSON.stringify(client));
      }

      // Check rate limiting
      const rateLimit = await redis.checkRateLimit(
        apiKey, 
        60, // 1 minute window
        client.rate_limit_per_minute
      );
      
      if (!rateLimit.allowed) {
        logger.securityEvent('rate_limit_exceeded', {
          clientId: client.id,
          current: rateLimit.current,
          limit: client.rate_limit_per_minute
        });
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Rate limit of ${client.rate_limit_per_minute} requests per minute exceeded`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      // Check monthly quota
      if (client.current_usage >= client.monthly_quota) {
        return res.status(402).json({
          error: 'Quota exceeded',
          message: 'Monthly quota exceeded. Please upgrade your plan or wait for next billing cycle.',
          currentUsage: client.current_usage,
          quota: client.monthly_quota
        });
      }

      // Add client info to request
      req.enterpriseClient = client;
      req.apiKey = apiKey;
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': client.rate_limit_per_minute,
        'X-RateLimit-Remaining': rateLimit.remaining,
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
      });
      
      next();
      
    } catch (error) {
      logger.error('Enterprise authentication error:', error);
      res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error'
      });
    }
  }

  // Validate researcher access (for Big Pharma licensing)
  async validateResearcher(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          error: 'Authorization token required',
          message: 'Bearer token must be provided'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Check if user has researcher permissions
      const query = `
        SELECT u.id, u.email, u.role, r.permissions, r.datasets_access
        FROM users u
        LEFT JOIN researcher_permissions r ON u.id = r.user_id
        WHERE u.id = $1 AND u.status = 'active'
      `;
      
      const result = await database.query(query, [decoded.userId]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'User not found or inactive'
        });
      }
      
      const user = result.rows[0];
      
      if (user.role !== 'researcher' && user.role !== 'admin') {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Researcher role required'
        });
      }

      req.researcher = user;
      next();
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'JWT token is invalid'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'JWT token has expired'
        });
      }
      
      logger.error('Researcher authentication error:', error);
      res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error'
      });
    }
  }

  // Validate internal service-to-service communication
  async validateServiceAuth(req, res, next) {
    try {
      const serviceKey = req.headers['x-service-key'];
      const expectedKey = process.env.INTERNAL_SERVICE_KEY;
      
      if (!serviceKey || !expectedKey) {
        return res.status(401).json({
          error: 'Service authentication required',
          message: 'Internal service key required'
        });
      }
      
      if (serviceKey !== expectedKey) {
        logger.securityEvent('invalid_service_key', { 
          sourceIP: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(401).json({
          error: 'Invalid service key',
          message: 'Service authentication failed'
        });
      }
      
      req.isInternalService = true;
      next();
      
    } catch (error) {
      logger.error('Service authentication error:', error);
      res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error'
      });
    }
  }

  // Check specific endpoint permissions
  checkEndpointPermission(requiredPermission) {
    return (req, res, next) => {
      const client = req.enterpriseClient;
      
      if (!client || !client.permissions) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Endpoint access not permitted'
        });
      }
      
      const permissions = typeof client.permissions === 'string' 
        ? JSON.parse(client.permissions) 
        : client.permissions;
      
      if (!permissions[requiredPermission]) {
        logger.securityEvent('permission_denied', {
          clientId: client.id,
          requiredPermission,
          endpoint: req.path
        });
        
        return res.status(403).json({
          error: 'Permission denied',
          message: `Access to ${requiredPermission} not permitted for your tier`
        });
      }
      
      next();
    };
  }

  // Billing tracking middleware
  async trackUsage(req, res, next) {
    const originalSend = res.send;
    const startTime = Date.now();
    
    res.send = function(data) {
      // Track API usage for billing
      if (req.enterpriseClient) {
        const responseTime = Date.now() - startTime;
        const dataPoints = req.dataPointsProcessed || 1;
        
        // Calculate billing amount based on tier
        const costPerDataPoint = req.enterpriseClient.tier === 'premium' ? 0.01 : 0.05;
        const billingAmount = dataPoints * costPerDataPoint;
        
        // Track in Redis for real-time monitoring
        redis.trackAPIUsage(req.apiKey, req.path, dataPoints)
          .catch(error => logger.error('Usage tracking failed:', error));
        
        // Log for billing
        logger.apiUsage(req.apiKey, req.path, responseTime, dataPoints, billingAmount);
        
        // Update database asynchronously
        setImmediate(async () => {
          try {
            const query = `
              INSERT INTO api_usage (
                api_key_id, endpoint, request_count, response_time_ms,
                data_points_processed, billing_amount, request_metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            
            const values = [
              req.enterpriseClient.id,
              req.path,
              1,
              responseTime,
              dataPoints,
              billingAmount,
              JSON.stringify({
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                timestamp: new Date().toISOString()
              })
            ];
            
            await database.query(query, values);
            
            // Update current usage
            await database.query(
              'UPDATE enterprise_clients SET current_usage = current_usage + $1 WHERE id = $2',
              [dataPoints, req.enterpriseClient.id]
            );
            
          } catch (error) {
            logger.error('Database usage tracking failed:', error);
          }
        });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  }

  // Generate API key for new enterprise clients
  generateAPIKey() {
    const prefix = 'saas_'; // SentimentAsAService prefix
    const randomBytes = crypto.randomBytes(24).toString('hex');
    return `${prefix}${randomBytes}`;
  }

  // Validate API key format
  isValidAPIKeyFormat(apiKey) {
    return /^saas_[a-f0-9]{48}$/.test(apiKey);
  }
}

module.exports = new AuthMiddleware();