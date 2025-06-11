const express = require('express');
const router = express.Router();
const Joi = require('joi');
const claudeSentimentService = require('../services/claudeAISentimentAnalysis');
const logger = require('../utils/logger');

// Validation schemas
const textAnalysisSchema = Joi.object({
  text: Joi.string().min(1).max(10000).required(),
  includeEmotions: Joi.boolean().default(true),
  includeKeyTerms: Joi.boolean().default(false),
  healthcareContext: Joi.boolean().default(true),
  relationshipContext: Joi.boolean().default(true)
});

const batchAnalysisSchema = Joi.object({
  texts: Joi.array().items(Joi.string().min(1).max(10000)).max(50).required(),
  includeEmotions: Joi.boolean().default(true),
  includeKeyTerms: Joi.boolean().default(false),
  healthcareContext: Joi.boolean().default(true),
  relationshipContext: Joi.boolean().default(true)
});

// Basic sentiment analysis endpoint (public)
router.post('/analyze', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = textAnalysisSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { text, includeEmotions, includeKeyTerms } = value;
    
    // Perform sentiment analysis with Claude AI
    const analysis = await claudeSentimentService.analyzeSentiment(text, {
      includeEmotions,
      includeKeyTerms,
      healthcareContext: value.healthcareContext,
      relationshipContext: value.relationshipContext
    });
    
    const result = {
      sentiment: {
        score: analysis.sentiment_score,
        category: analysis.sentiment_category,
        confidence: analysis.confidence
      },
      emotions: includeEmotions ? analysis.emotions : undefined,
      keyTerms: includeKeyTerms ? analysis.key_terms : undefined,
      healthcareContext: analysis.healthcare_context,
      relationshipContext: analysis.relationship_context,
      crisisAssessment: analysis.crisis_assessment,
      insights: analysis.insights,
      processingTime: analysis.processingTime,
      provider: 'claude-ai'
    };

    if (includeEmotions) {
      result.emotions = analysis.emotions;
    }

    if (includeKeyTerms) {
      result.keyTerms = analysis.context.keyTerms;
    }

    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('Sentiment analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: 'Internal server error'
    });
  }
});

// Batch sentiment analysis endpoint (public)
router.post('/analyze/batch', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = batchAnalysisSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { texts, includeEmotions, includeKeyTerms } = value;
    
    const results = [];
    
    for (const text of texts) {
      try {
        const analysis = await sentimentService.analyzeSentiment(text);
        
        const result = {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          sentiment: {
            score: analysis.score,
            category: analysis.category,
            confidence: analysis.confidence
          }
        };

        if (includeEmotions) {
          result.emotions = analysis.emotions;
        }

        if (includeKeyTerms) {
          result.keyTerms = analysis.context.keyTerms;
        }

        results.push(result);

      } catch (analysisError) {
        logger.error('Individual text analysis failed:', analysisError);
        results.push({
          text: text.substring(0, 100) + '...',
          error: 'Analysis failed',
          details: 'Unable to process this text'
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        totalTexts: texts.length,
        successfulAnalyses: results.filter(r => !r.error).length,
        failedAnalyses: results.filter(r => r.error).length,
        processingTime: Date.now() - startTime
      }
    });

  } catch (error) {
    logger.error('Batch sentiment analysis error:', error);
    res.status(500).json({
      error: 'Batch analysis failed',
      message: 'Internal server error'
    });
  }
});

// Healthcare-specific sentiment analysis
router.post('/analyze/healthcare', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = textAnalysisSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { text } = value;
    
    // Perform healthcare-specific sentiment analysis
    const analysis = await sentimentService.analyzeSentiment(text);
    
    // Extract healthcare-specific insights
    const healthcareInsights = {
      healthcareTermsDetected: analysis.context.healthcare?.indicators || [],
      clinicalSentiment: analysis.score,
      healthRiskIndicators: analysis.emotions,
      potentialConcerns: analysis.context.healthcare?.indicators
        ?.filter(indicator => indicator.weight < 0)
        ?.map(indicator => indicator.term) || []
    };

    res.json({
      success: true,
      sentiment: {
        score: analysis.score,
        category: analysis.category,
        confidence: analysis.confidence
      },
      healthcareInsights,
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('Healthcare sentiment analysis error:', error);
    res.status(500).json({
      error: 'Healthcare analysis failed',
      message: 'Internal server error'
    });
  }
});

// Relationship-specific sentiment analysis
router.post('/analyze/relationship', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = textAnalysisSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { text } = value;
    
    // Perform relationship-specific sentiment analysis
    const analysis = await sentimentService.analyzeSentiment(text);
    
    // Extract relationship-specific insights
    const relationshipInsights = {
      relationshipTermsDetected: analysis.context.relationship?.indicators || [],
      relationshipSentiment: analysis.score,
      emotionalDynamics: analysis.emotions,
      communicationPatterns: this.analyzeCommuncationPatterns(text),
      conflictIndicators: analysis.context.relationship?.indicators
        ?.filter(indicator => indicator.weight < 0)
        ?.map(indicator => indicator.term) || [],
      positiveIndicators: analysis.context.relationship?.indicators
        ?.filter(indicator => indicator.weight > 0)
        ?.map(indicator => indicator.term) || []
    };

    res.json({
      success: true,
      sentiment: {
        score: analysis.score,
        category: analysis.category,
        confidence: analysis.confidence
      },
      relationshipInsights,
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('Relationship sentiment analysis error:', error);
    res.status(500).json({
      error: 'Relationship analysis failed',
      message: 'Internal server error'
    });
  }
});

// Get sentiment trends for public demo
router.get('/trends/demo', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    // Generate demo data for public showcase
    const demoTrends = this.generateDemoTrends(timeframe);
    
    res.json({
      success: true,
      demo: true,
      timeframe,
      trends: demoTrends,
      note: 'This is demo data for showcase purposes. Real data requires API authentication.'
    });

  } catch (error) {
    logger.error('Demo trends error:', error);
    res.status(500).json({
      error: 'Failed to generate demo trends',
      message: 'Internal server error'
    });
  }
});

// Helper function to analyze communication patterns
function analyzeCommuncationPatterns(text) {
  const patterns = {
    firstPerson: (text.match(/\b(I|me|my|myself)\b/gi) || []).length,
    secondPerson: (text.match(/\b(you|your|yourself)\b/gi) || []).length,
    questions: (text.match(/\?/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
    negations: (text.match(/\b(not|no|never|nothing|nobody|nowhere)\b/gi) || []).length
  };

  return {
    ...patterns,
    communicationStyle: patterns.firstPerson > patterns.secondPerson ? 'self-focused' : 
                       patterns.secondPerson > patterns.firstPerson ? 'other-focused' : 'balanced',
    emotionalIntensity: patterns.exclamations > 2 ? 'high' : patterns.exclamations > 0 ? 'medium' : 'low',
    engagement: patterns.questions > 1 ? 'high' : patterns.questions > 0 ? 'medium' : 'low'
  };
}

// Helper function to generate demo data
function generateDemoTrends(timeframe) {
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const trends = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Generate realistic demo sentiment data
    const baseScore = 0.1 + Math.sin(i * 0.3) * 0.3; // Sine wave with noise
    const noise = (Math.random() - 0.5) * 0.4;
    const score = Math.max(-1, Math.min(1, baseScore + noise));
    
    trends.push({
      date: date.toISOString().split('T')[0],
      avgSentiment: Math.round(score * 1000) / 1000,
      dataPoints: Math.floor(Math.random() * 100) + 50,
      distribution: {
        positive: Math.floor(Math.random() * 40) + 30,
        negative: Math.floor(Math.random() * 30) + 10,
        neutral: Math.floor(Math.random() * 30) + 20
      }
    });
  }
  
  return trends;
}

module.exports = router;