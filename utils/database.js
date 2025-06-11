const { Pool } = require('pg');
const logger = require('./logger');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      this.pool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'ecosystem_intelligence',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
        max: 20, // Increased pool size for enterprise workload
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connection established');

      // Create SentimentAsAService tables
      await this.createTables();
      
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Master sentiment data aggregation
      `CREATE TABLE IF NOT EXISTS sentiment_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        app_name VARCHAR(100) NOT NULL,
        user_id UUID NOT NULL,
        sentiment_score DECIMAL(3,2) NOT NULL, -- -1.00 to 1.00
        sentiment_category VARCHAR(50) NOT NULL, -- positive, negative, neutral, mixed
        text_content TEXT,
        emotional_indicators JSONB, -- detailed emotional analysis
        context_metadata JSONB, -- app-specific context
        anonymized_content TEXT, -- privacy-safe version
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (app_name, created_at),
        INDEX (user_id, created_at),
        INDEX (sentiment_category, created_at)
      )`,

      // Enterprise API usage tracking
      `CREATE TABLE IF NOT EXISTS api_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id UUID NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        request_count INTEGER DEFAULT 1,
        response_time_ms INTEGER,
        data_points_processed INTEGER,
        billing_amount DECIMAL(10,4), -- calculated cost
        request_metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (api_key_id, created_at),
        INDEX (endpoint, created_at)
      )`,

      // Enterprise API keys and clients
      `CREATE TABLE IF NOT EXISTS enterprise_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        tier VARCHAR(50) DEFAULT 'standard', -- standard, premium, enterprise
        rate_limit_per_minute INTEGER DEFAULT 100,
        monthly_quota INTEGER DEFAULT 10000,
        current_usage INTEGER DEFAULT 0,
        billing_plan JSONB, -- pricing and billing details
        permissions JSONB, -- endpoint access permissions
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Research datasets for Big Pharma
      `CREATE TABLE IF NOT EXISTS research_datasets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dataset_name VARCHAR(255) NOT NULL,
        description TEXT,
        anonymization_level VARCHAR(50) NOT NULL, -- basic, advanced, differential_privacy
        data_points_count INTEGER,
        date_range_start DATE,
        date_range_end DATE,
        demographics_summary JSONB,
        clinical_correlations JSONB,
        licensing_terms JSONB,
        price_per_record DECIMAL(10,4),
        status VARCHAR(50) DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (status, created_at)
      )`,

      // Dataset licensing contracts
      `CREATE TABLE IF NOT EXISTS dataset_licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dataset_id UUID REFERENCES research_datasets(id),
        licensee_company VARCHAR(255) NOT NULL,
        license_type VARCHAR(100) NOT NULL, -- research, commercial, exclusive
        contract_value DECIMAL(12,2),
        duration_months INTEGER,
        data_points_licensed INTEGER,
        usage_restrictions JSONB,
        contract_metadata JSONB,
        signed_at TIMESTAMP,
        expires_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Cross-app correlation analysis
      `CREATE TABLE IF NOT EXISTS correlation_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_type VARCHAR(100) NOT NULL, -- relationship_health, treatment_outcome, behavior_pattern
        app_combinations TEXT[], -- which apps contributed data
        user_cohort_size INTEGER,
        correlation_strength DECIMAL(3,2), -- statistical correlation
        clinical_significance JSONB,
        key_findings JSONB,
        methodology JSONB,
        peer_review_status VARCHAR(50),
        publication_ready BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (analysis_type, created_at)
      )`,

      // ML model training data and results
      `CREATE TABLE IF NOT EXISTS ml_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(255) NOT NULL,
        model_type VARCHAR(100) NOT NULL, -- sentiment_analysis, correlation_prediction, health_outcome
        training_data_summary JSONB,
        performance_metrics JSONB,
        model_file_path VARCHAR(500),
        version VARCHAR(50),
        trained_by VARCHAR(255),
        deployment_status VARCHAR(50) DEFAULT 'development',
        api_endpoint VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Anonymization and privacy tracking
      `CREATE TABLE IF NOT EXISTS privacy_operations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operation_type VARCHAR(100) NOT NULL, -- anonymize, aggregate, k_anonymity
        source_data_id UUID,
        source_table VARCHAR(255),
        privacy_level VARCHAR(50), -- HIPAA, differential_privacy, k_anonymity_5
        transformation_rules JSONB,
        output_data_id UUID,
        compliance_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (operation_type, created_at)
      )`
    ];

    for (const table of tables) {
      try {
        await this.pool.query(table);
        logger.info('Table created or verified');
      } catch (error) {
        logger.error('Error creating table:', error);
        throw error;
      }
    }

    logger.info('All SentimentAsAService tables created successfully');
  }

  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', { duration, query: text.substring(0, 100) });
      }
      
      return result;
    } catch (error) {
      logger.error('Database query error:', { error: error.message, query: text.substring(0, 100) });
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async checkConnection() {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Database connection check failed:', error);
      return false;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }
}

module.exports = new Database();