const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, service = 'sentimentasaservice', ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        service,
        message,
        ...meta
      });
    })
  ),
  defaultMeta: { service: 'sentimentasaservice' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),

    // Separate file for API usage analytics
    new winston.transports.File({
      filename: path.join(logsDir, 'api-usage.log'),
      level: 'info',
      maxsize: 10485760,
      maxFiles: 20,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, apiKey, endpoint, responseTime, ...meta }) => {
          if (message.includes('API_USAGE')) {
            return JSON.stringify({
              timestamp,
              apiKey,
              endpoint,
              responseTime,
              ...meta
            });
          }
          return '';
        })
      )
    }),

    // Separate file for ML operations
    new winston.transports.File({
      filename: path.join(logsDir, 'ml-operations.log'),
      level: 'info',
      maxsize: 10485760,
      maxFiles: 15,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, modelId, operation, ...meta }) => {
          if (message.includes('ML_OPERATION')) {
            return JSON.stringify({
              timestamp,
              modelId,
              operation,
              ...meta
            });
          }
          return '';
        })
      )
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// Helper functions for specific logging scenarios
logger.apiUsage = (apiKey, endpoint, responseTime, dataPoints, billingAmount) => {
  logger.info('API_USAGE', {
    apiKey: apiKey?.substring(0, 8) + '...',
    endpoint,
    responseTime,
    dataPoints,
    billingAmount
  });
};

logger.mlOperation = (modelId, operation, inputSize, outputSize, processingTime) => {
  logger.info('ML_OPERATION', {
    modelId,
    operation,
    inputSize,
    outputSize,
    processingTime
  });
};

logger.datasetAccess = (datasetId, clientId, recordCount, anonymizationLevel) => {
  logger.info('DATASET_ACCESS', {
    datasetId,
    clientId: clientId?.substring(0, 8) + '...',
    recordCount,
    anonymizationLevel
  });
};

logger.securityEvent = (eventType, details, severity = 'warn') => {
  logger[severity]('SECURITY_EVENT', {
    eventType,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.billingEvent = (clientId, amount, description, metadata) => {
  logger.info('BILLING_EVENT', {
    clientId: clientId?.substring(0, 8) + '...',
    amount,
    description,
    metadata
  });
};

module.exports = logger;