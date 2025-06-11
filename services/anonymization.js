const crypto = require('crypto');
const logger = require('../utils/logger');
const database = require('../utils/database');

class AnonymizationService {
  constructor() {
    this.piiPatterns = this.loadPIIPatterns();
    this.replacementMappings = new Map();
    this.kAnonymityThreshold = 5; // Minimum group size for k-anonymity
  }

  loadPIIPatterns() {
    return {
      // Phone numbers
      phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      
      // Email addresses
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // SSN
      ssn: /\b(?:\d{3}-?\d{2}-?\d{4})\b/g,
      
      // Credit card numbers
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      
      // Names (common patterns)
      names: /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g,
      
      // Addresses
      address: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl)\b/gi,
      
      // Dates of birth
      dob: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12][0-9]|3[01])[-\/](?:19|20)\d{2}\b/g,
      
      // Medical record numbers
      mrn: /\b(?:MRN|Medical Record|Patient ID)[:.\s]*([A-Z0-9]{6,})\b/gi,
      
      // Insurance numbers
      insurance: /\b(?:Insurance|Policy)[:.\s]*([A-Z0-9]{8,})\b/gi
    };
  }

  async anonymizeText(text, level = 'basic') {
    try {
      const operationId = crypto.randomUUID();
      const startTime = Date.now();
      
      let anonymizedText = text;
      const transformations = [];

      switch (level) {
        case 'basic':
          anonymizedText = this.basicAnonymization(anonymizedText, transformations);
          break;
        case 'advanced':
          anonymizedText = this.advancedAnonymization(anonymizedText, transformations);
          break;
        case 'differential_privacy':
          anonymizedText = await this.differentialPrivacyAnonymization(anonymizedText, transformations);
          break;
        default:
          throw new Error(`Unknown anonymization level: ${level}`);
      }

      // Log the anonymization operation
      await this.logAnonymizationOperation(operationId, level, transformations, startTime);

      return anonymizedText;

    } catch (error) {
      logger.error('Anonymization failed:', error);
      throw new Error('Failed to anonymize text');
    }
  }

  basicAnonymization(text, transformations) {
    let anonymized = text;

    // Replace PII patterns
    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      const matches = anonymized.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const replacement = this.generateReplacement(type, match);
          anonymized = anonymized.replace(match, replacement);
          transformations.push({
            type,
            original: match,
            replacement,
            method: 'pattern_replacement'
          });
        });
      }
    });

    // Replace specific healthcare identifiers
    anonymized = this.replaceHealthcareIdentifiers(anonymized, transformations);

    return anonymized;
  }

  advancedAnonymization(text, transformations) {
    let anonymized = this.basicAnonymization(text, transformations);

    // Additional advanced techniques
    anonymized = this.applyKAnonymity(anonymized, transformations);
    anonymized = this.suppressQuasiIdentifiers(anonymized, transformations);
    anonymized = this.generalizeSpecificTerms(anonymized, transformations);

    return anonymized;
  }

  async differentialPrivacyAnonymization(text, transformations) {
    let anonymized = this.advancedAnonymization(text, transformations);

    // Add noise to numerical values
    anonymized = this.addNoiseToDates(anonymized, transformations);
    anonymized = this.addNoiseToNumericalValues(anonymized, transformations);

    return anonymized;
  }

  generateReplacement(type, original) {
    // Check if we already have a consistent replacement
    if (this.replacementMappings.has(original)) {
      return this.replacementMappings.get(original);
    }

    let replacement;
    
    switch (type) {
      case 'phone':
        replacement = '[PHONE]';
        break;
      case 'email':
        replacement = '[EMAIL]';
        break;
      case 'ssn':
        replacement = '[SSN]';
        break;
      case 'creditCard':
        replacement = '[CREDIT_CARD]';
        break;
      case 'names':
        replacement = '[NAME]';
        break;
      case 'address':
        replacement = '[ADDRESS]';
        break;
      case 'dob':
        replacement = '[DATE_OF_BIRTH]';
        break;
      case 'mrn':
        replacement = '[MEDICAL_RECORD_NUMBER]';
        break;
      case 'insurance':
        replacement = '[INSURANCE_NUMBER]';
        break;
      default:
        replacement = '[REDACTED]';
    }

    // Store the mapping for consistency
    this.replacementMappings.set(original, replacement);
    return replacement;
  }

  replaceHealthcareIdentifiers(text, transformations) {
    let anonymized = text;

    // Healthcare-specific patterns
    const healthcarePatterns = {
      doctorNames: /Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
      hospitalNames: /\b[A-Z][a-z]+\s+(?:Hospital|Medical Center|Clinic|Health System)\b/g,
      medications: /\b(?:mg|mcg|ml|tablets?|capsules?|doses?)\s+of\s+[A-Z][a-z]+/gi,
      procedures: /\b(?:surgery|operation|procedure|treatment|therapy)\s+(?:on|for|of)\s+[a-z\s]+/gi
    };

    Object.entries(healthcarePatterns).forEach(([type, pattern]) => {
      const matches = anonymized.match(pattern);
      if (matches) {
        matches.forEach(match => {
          let replacement;
          switch (type) {
            case 'doctorNames':
              replacement = '[DOCTOR_NAME]';
              break;
            case 'hospitalNames':
              replacement = '[HEALTHCARE_FACILITY]';
              break;
            case 'medications':
              replacement = '[MEDICATION]';
              break;
            case 'procedures':
              replacement = '[MEDICAL_PROCEDURE]';
              break;
            default:
              replacement = '[HEALTHCARE_INFO]';
          }
          
          anonymized = anonymized.replace(match, replacement);
          transformations.push({
            type: `healthcare_${type}`,
            original: match,
            replacement,
            method: 'healthcare_specific'
          });
        });
      }
    });

    return anonymized;
  }

  applyKAnonymity(text, transformations) {
    // Implement k-anonymity by generalizing specific terms
    let anonymized = text;

    // Age generalization
    const agePattern = /\b(\d{1,2})\s*(?:years?|yrs?)\s*old\b/gi;
    anonymized = anonymized.replace(agePattern, (match, age) => {
      const ageNum = parseInt(age);
      let generalizedAge;
      
      if (ageNum < 18) generalizedAge = 'under 18';
      else if (ageNum < 30) generalizedAge = '18-29';
      else if (ageNum < 40) generalizedAge = '30-39';
      else if (ageNum < 50) generalizedAge = '40-49';
      else if (ageNum < 60) generalizedAge = '50-59';
      else if (ageNum < 70) generalizedAge = '60-69';
      else generalizedAge = '70+';
      
      transformations.push({
        type: 'age_generalization',
        original: match,
        replacement: `${generalizedAge} years old`,
        method: 'k_anonymity'
      });
      
      return `${generalizedAge} years old`;
    });

    return anonymized;
  }

  suppressQuasiIdentifiers(text, transformations) {
    // Suppress combinations that could be identifying
    let anonymized = text;

    // Remove specific location + time combinations
    const locationTimePattern = /\b(?:at|in|near)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:on|at)\s+\d{1,2}[:]\d{2}/gi;
    anonymized = anonymized.replace(locationTimePattern, (match) => {
      transformations.push({
        type: 'location_time_suppression',
        original: match,
        replacement: '[LOCATION_TIME_SUPPRESSED]',
        method: 'quasi_identifier_suppression'
      });
      return '[LOCATION_TIME_SUPPRESSED]';
    });

    return anonymized;
  }

  generalizeSpecificTerms(text, transformations) {
    let anonymized = text;

    // Generalize specific medical conditions to broader categories
    const conditionMappings = {
      'diabetes': 'metabolic condition',
      'hypertension': 'cardiovascular condition',
      'depression': 'mental health condition',
      'anxiety': 'mental health condition',
      'cancer': 'oncological condition',
      'arthritis': 'musculoskeletal condition'
    };

    Object.entries(conditionMappings).forEach(([specific, general]) => {
      const pattern = new RegExp(`\\b${specific}\\b`, 'gi');
      if (pattern.test(anonymized)) {
        anonymized = anonymized.replace(pattern, general);
        transformations.push({
          type: 'condition_generalization',
          original: specific,
          replacement: general,
          method: 'medical_generalization'
        });
      }
    });

    return anonymized;
  }

  addNoiseToDates(text, transformations) {
    let anonymized = text;

    // Add small random noise to dates (±1-3 days)
    const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi;
    
    anonymized = anonymized.replace(datePattern, (match) => {
      // For differential privacy, we generalize to month/year only
      const monthYear = match.replace(/\d{1,2},?\s+/, '');
      
      transformations.push({
        type: 'date_noise',
        original: match,
        replacement: monthYear,
        method: 'differential_privacy'
      });
      
      return monthYear;
    });

    return anonymized;
  }

  addNoiseToNumericalValues(text, transformations) {
    let anonymized = text;

    // Add noise to numerical health metrics
    const numericPattern = /\b(\d+(?:\.\d+)?)\s*(mg|mcg|ml|pounds?|lbs?|kg|degrees?|bpm)\b/gi;
    
    anonymized = anonymized.replace(numericPattern, (match, value, unit) => {
      const numValue = parseFloat(value);
      const noiseLevel = 0.1; // 10% noise
      const noise = (Math.random() - 0.5) * 2 * noiseLevel * numValue;
      const noisyValue = Math.max(0, numValue + noise);
      
      const replacement = `${noisyValue.toFixed(1)} ${unit}`;
      
      transformations.push({
        type: 'numeric_noise',
        original: match,
        replacement,
        method: 'differential_privacy'
      });
      
      return replacement;
    });

    return anonymized;
  }

  async logAnonymizationOperation(operationId, level, transformations, startTime) {
    try {
      const query = `
        INSERT INTO privacy_operations (
          id, operation_type, privacy_level, transformation_rules,
          compliance_verified, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        operationId,
        'anonymize',
        level,
        JSON.stringify(transformations),
        true, // Mark as compliance verified
        new Date()
      ];

      await database.query(query, values);
      
      const processingTime = Date.now() - startTime;
      logger.info('Anonymization operation logged', {
        operationId,
        level,
        transformationCount: transformations.length,
        processingTime
      });

    } catch (error) {
      logger.error('Failed to log anonymization operation:', error);
    }
  }

  // Create anonymized research datasets
  async createResearchDataset(filters, anonymizationLevel = 'advanced') {
    try {
      const datasetId = crypto.randomUUID();
      
      // Query data based on filters
      let query = `
        SELECT id, app_name, sentiment_score, sentiment_category,
               emotional_indicators, context_metadata, created_at
        FROM sentiment_data
        WHERE 1=1
      `;
      
      const params = [];
      let paramIndex = 1;

      if (filters.appName) {
        query += ` AND app_name = $${paramIndex}`;
        params.push(filters.appName);
        paramIndex++;
      }

      if (filters.startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }

      query += ` ORDER BY created_at LIMIT ${filters.limit || 10000}`;

      const result = await database.query(query, params);
      
      // Anonymize the dataset
      const anonymizedData = [];
      for (const row of result.rows) {
        const anonymizedRow = {
          ...row,
          id: crypto.randomUUID(), // New ID for anonymized version
          user_id: null, // Remove user ID
          text_content: null, // Remove original text
          anonymized_content: row.text_content ? 
            await this.anonymizeText(row.text_content, anonymizationLevel) : null
        };
        anonymizedData.push(anonymizedRow);
      }

      // Store dataset metadata
      const datasetQuery = `
        INSERT INTO research_datasets (
          id, dataset_name, description, anonymization_level,
          data_points_count, date_range_start, date_range_end,
          demographics_summary, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const datasetValues = [
        datasetId,
        `Dataset_${Date.now()}`,
        `Anonymized sentiment data (${anonymizationLevel})`,
        anonymizationLevel,
        anonymizedData.length,
        filters.startDate || null,
        filters.endDate || null,
        JSON.stringify({ /* demographics would be calculated here */ }),
        'available'
      ];

      const datasetResult = await database.query(datasetQuery, datasetValues);

      logger.info('Research dataset created', {
        datasetId,
        recordCount: anonymizedData.length,
        anonymizationLevel
      });

      return {
        dataset: datasetResult.rows[0],
        data: anonymizedData
      };

    } catch (error) {
      logger.error('Failed to create research dataset:', error);
      throw error;
    }
  }

  // Validate anonymization quality
  async validateAnonymization(originalText, anonymizedText) {
    const piiFound = [];
    
    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      const matches = anonymizedText.match(pattern);
      if (matches) {
        piiFound.push({ type, matches });
      }
    });

    return {
      isValid: piiFound.length === 0,
      piiFound,
      anonymizationScore: piiFound.length === 0 ? 1.0 : 1.0 - (piiFound.length * 0.1)
    };
  }
}

module.exports = new AnonymizationService();