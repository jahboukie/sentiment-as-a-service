const natural = require('natural');
const Sentiment = require('sentiment');
const compromise = require('compromise');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

class SentimentAnalysisService {
  constructor() {
    this.sentiment = new Sentiment();
    this.healthcareTerms = this.loadHealthcareTerms();
    this.relationshipTerms = this.loadRelationshipTerms();
    this.emotionalIndicators = this.loadEmotionalIndicators();
    
    // Add healthcare-specific sentiment words
    this.sentiment.registerLanguage('healthcare', {
      labels: this.healthcareTerms
    });
  }

  loadHealthcareTerms() {
    return {
      // Positive healthcare terms
      'recovery': 5,
      'healing': 4,
      'improvement': 4,
      'progress': 3,
      'stable': 2,
      'comfortable': 3,
      'relief': 4,
      'better': 3,
      'wellness': 4,
      'healthy': 4,
      'cured': 5,
      'remission': 4,
      'treatment': 2,
      'therapy': 2,
      'medication': 1,
      'support': 3,
      'hope': 4,
      'optimistic': 4,
      'confident': 3,
      'energetic': 4,
      
      // Negative healthcare terms
      'pain': -4,
      'suffering': -5,
      'sick': -3,
      'illness': -3,
      'disease': -3,
      'symptom': -2,
      'diagnosis': -1,
      'chronic': -2,
      'acute': -3,
      'severe': -4,
      'critical': -5,
      'emergency': -4,
      'crisis': -4,
      'relapse': -5,
      'deteriorating': -4,
      'complications': -3,
      'infection': -3,
      'inflammation': -2,
      'fatigue': -3,
      'exhausted': -4,
      'nausea': -3,
      'dizzy': -2,
      'anxious': -3,
      'depressed': -4,
      'scared': -4,
      'worried': -3,
      'uncertain': -2,
      'hopeless': -5
    };
  }

  loadRelationshipTerms() {
    return {
      // Positive relationship terms
      'love': 5,
      'caring': 4,
      'support': 4,
      'understanding': 4,
      'connection': 3,
      'intimacy': 4,
      'commitment': 3,
      'trust': 4,
      'respect': 4,
      'communication': 3,
      'partnership': 3,
      'together': 3,
      'harmony': 4,
      'affection': 4,
      'appreciation': 3,
      'gratitude': 4,
      'bond': 3,
      'closeness': 4,
      'teamwork': 3,
      'compatibility': 3,
      
      // Negative relationship terms
      'argument': -3,
      'fight': -4,
      'conflict': -4,
      'tension': -3,
      'distance': -2,
      'disconnected': -3,
      'misunderstanding': -2,
      'betrayal': -5,
      'cheating': -5,
      'lies': -4,
      'distrust': -4,
      'resentment': -4,
      'anger': -4,
      'frustration': -3,
      'disappointment': -3,
      'criticism': -2,
      'rejection': -4,
      'abandonment': -5,
      'lonely': -4,
      'isolated': -3,
      'neglected': -3,
      'ignored': -3,
      'breakdown': -5,
      'separation': -4,
      'divorce': -4
    };
  }

  loadEmotionalIndicators() {
    return {
      joy: ['happy', 'excited', 'thrilled', 'delighted', 'ecstatic', 'cheerful', 'upbeat'],
      sadness: ['sad', 'depressed', 'melancholy', 'grief', 'sorrow', 'heartbroken', 'devastated'],
      anger: ['angry', 'furious', 'rage', 'mad', 'irritated', 'annoyed', 'frustrated'],
      fear: ['scared', 'afraid', 'terrified', 'anxious', 'worried', 'nervous', 'panic'],
      disgust: ['disgusted', 'revolted', 'repulsed', 'sickened', 'appalled'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'stunned'],
      trust: ['trust', 'confident', 'secure', 'faith', 'belief', 'reliable'],
      anticipation: ['excited', 'eager', 'hopeful', 'expectant', 'optimistic', 'looking forward']
    };
  }

  async analyzeSentiment(text) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const textHash = this.generateTextHash(text);
      const cached = await redis.getCachedSentimentResult(textHash);
      if (cached) {
        logger.info('Sentiment analysis cache hit', { textHash });
        return cached;
      }

      // Preprocess text
      const processedText = this.preprocessText(text);
      
      // Basic sentiment analysis
      const basicSentiment = this.sentiment.analyze(processedText);
      
      // Healthcare-specific analysis
      const healthcareSentiment = this.analyzeHealthcareContext(processedText);
      
      // Relationship-specific analysis
      const relationshipSentiment = this.analyzeRelationshipContext(processedText);
      
      // Emotional analysis
      const emotions = this.analyzeEmotions(processedText);
      
      // Combine results with weighted scoring
      const combinedScore = this.calculateCombinedScore(
        basicSentiment.score,
        healthcareSentiment.score,
        relationshipSentiment.score
      );

      // Normalize score to -1 to 1 range
      const normalizedScore = this.normalizeScore(combinedScore, processedText.split(' ').length);
      
      // Determine category
      const category = this.determineCategory(normalizedScore);
      
      const result = {
        score: Math.round(normalizedScore * 100) / 100, // Round to 2 decimal places
        category,
        emotions,
        context: {
          healthcare: healthcareSentiment.indicators,
          relationship: relationshipSentiment.indicators,
          wordCount: processedText.split(' ').length,
          keyTerms: this.extractKeyTerms(processedText)
        },
        confidence: this.calculateConfidence(basicSentiment, emotions),
        processingTime: Date.now() - startTime
      };

      // Cache result
      await redis.cacheSentimentResult(textHash, result, 3600);
      
      logger.info('Sentiment analysis completed', {
        score: result.score,
        category: result.category,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      throw new Error('Failed to analyze sentiment');
    }
  }

  preprocessText(text) {
    // Clean and normalize text
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  analyzeHealthcareContext(text) {
    let score = 0;
    const indicators = [];
    
    Object.entries(this.healthcareTerms).forEach(([term, weight]) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += weight * matches.length;
        indicators.push({ term, count: matches.length, weight });
      }
    });

    return { score, indicators };
  }

  analyzeRelationshipContext(text) {
    let score = 0;
    const indicators = [];
    
    Object.entries(this.relationshipTerms).forEach(([term, weight]) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += weight * matches.length;
        indicators.push({ term, count: matches.length, weight });
      }
    });

    return { score, indicators };
  }

  analyzeEmotions(text) {
    const emotions = {};
    
    Object.entries(this.emotionalIndicators).forEach(([emotion, terms]) => {
      let count = 0;
      terms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          count += matches.length;
        }
      });
      if (count > 0) {
        emotions[emotion] = count;
      }
    });

    return emotions;
  }

  calculateCombinedScore(basicScore, healthcareScore, relationshipScore) {
    // Weighted combination: basic sentiment gets 50%, healthcare 30%, relationship 20%
    return (basicScore * 0.5) + (healthcareScore * 0.3) + (relationshipScore * 0.2);
  }

  normalizeScore(score, wordCount) {
    // Normalize based on word count and expected range
    const averageWordsPerSentiment = 10;
    const adjustment = Math.min(wordCount / averageWordsPerSentiment, 3);
    
    let normalizedScore = score / (adjustment || 1);
    
    // Ensure score is between -1 and 1
    return Math.max(-1, Math.min(1, normalizedScore / 10));
  }

  determineCategory(score) {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    if (score >= -0.1 && score <= 0.1) return 'neutral';
    return 'mixed';
  }

  extractKeyTerms(text) {
    const doc = compromise(text);
    
    // Extract nouns, adjectives, and important verbs
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    const verbs = doc.verbs().out('array');
    
    return {
      nouns: nouns.slice(0, 5),
      adjectives: adjectives.slice(0, 5),
      verbs: verbs.slice(0, 3)
    };
  }

  calculateConfidence(basicSentiment, emotions) {
    // Calculate confidence based on sentiment strength and emotional indicators
    const sentimentStrength = Math.abs(basicSentiment.score);
    const emotionalIndicatorCount = Object.keys(emotions).length;
    
    let confidence = Math.min(1, (sentimentStrength / 10) + (emotionalIndicatorCount * 0.1));
    return Math.round(confidence * 100) / 100;
  }

  generateTextHash(text) {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Batch analysis for improved performance
  async analyzeBatch(texts) {
    const results = [];
    
    for (const text of texts) {
      try {
        const result = await this.analyzeSentiment(text);
        results.push(result);
      } catch (error) {
        logger.error('Batch sentiment analysis error:', error);
        results.push({
          error: 'Analysis failed',
          text: text.substring(0, 50) + '...'
        });
      }
    }
    
    return results;
  }

  // Get sentiment trends over time
  async getTrends(userId, appName, days = 30) {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          AVG(sentiment_score) as avg_sentiment,
          COUNT(*) as data_points
        FROM sentiment_data
        WHERE user_id = $1 
        AND app_name = $2
        AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      const result = await database.query(query, [userId, appName]);
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting sentiment trends:', error);
      throw error;
    }
  }
}

module.exports = new SentimentAnalysisService();