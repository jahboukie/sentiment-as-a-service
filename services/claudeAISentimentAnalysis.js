const axios = require('axios');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

class ClaudeAISentimentAnalysisService {
  constructor() {
    this.claudeApiKey = process.env.ANTHROPIC_API_KEY;
    this.claudeApiUrl = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20241022';
    
    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
  }

  async analyzeSentiment(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const textHash = this.generateTextHash(text + JSON.stringify(options));
      const cached = await redis.getCachedSentimentResult(textHash);
      if (cached) {
        logger.info('Claude AI sentiment analysis cache hit', { textHash });
        return cached;
      }

      const prompt = this.buildSentimentPrompt(text, options);
      
      const response = await axios.post(this.claudeApiUrl, {
        model: this.model,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      const analysis = JSON.parse(response.data.content[0].text);
      
      const result = {
        ...analysis,
        processingTime: Date.now() - startTime,
        provider: 'claude-ai',
        model: this.model
      };

      // Cache result for 1 hour
      await redis.cacheSentimentResult(textHash, result, 3600);
      
      logger.info('Claude AI sentiment analysis completed', {
        score: result.sentiment_score,
        category: result.sentiment_category,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      logger.error('Claude AI sentiment analysis failed:', error);
      throw new Error('Failed to analyze sentiment with Claude AI');
    }
  }

  buildSentimentPrompt(text, options = {}) {
    const {
      includeEmotions = true,
      includeKeyTerms = true,
      healthcareContext = true,
      relationshipContext = true,
      crisisDetection = true
    } = options;

    return `You are an expert sentiment analysis AI specializing in healthcare and relationship contexts. Analyze the following text and provide a comprehensive sentiment analysis.

TEXT TO ANALYZE:
"${text}"

ANALYSIS REQUIREMENTS:
${healthcareContext ? '- Focus on healthcare-specific sentiment indicators (symptoms, treatments, recovery, pain, etc.)' : ''}
${relationshipContext ? '- Analyze relationship dynamics (support, communication, conflict, connection, etc.)' : ''}
${crisisDetection ? '- Assess crisis risk level (emergency mental health situations, suicidal ideation, etc.)' : ''}
${includeEmotions ? '- Identify primary emotions present in the text' : ''}
${includeKeyTerms ? '- Extract key terms and phrases that drive the sentiment' : ''}

RESPONSE FORMAT (JSON):
{
  "sentiment_score": <number between -1 and 1>,
  "sentiment_category": "<positive|negative|neutral|mixed>",
  "confidence": <number between 0 and 1>,
  "healthcare_context": {
    "indicators": [
      {
        "term": "<healthcare term>",
        "sentiment_impact": <number>,
        "context": "<brief explanation>"
      }
    ],
    "health_status_trend": "<improving|stable|declining|unknown>",
    "treatment_sentiment": "<positive|negative|neutral|not_mentioned>"
  },
  "relationship_context": {
    "indicators": [
      {
        "term": "<relationship term>",
        "sentiment_impact": <number>,
        "context": "<brief explanation>"
      }
    ],
    "relationship_health": "<strong|healthy|strained|concerning|critical>",
    "support_level": "<high|medium|low|absent>",
    "communication_quality": "<excellent|good|fair|poor|breakdown>"
  },
  "crisis_assessment": {
    "risk_level": "<none|low|medium|high|critical>",
    "indicators": ["<list of concerning phrases or indicators>"],
    "recommended_action": "<none|monitoring|professional_support|immediate_intervention>"
  },
  "emotions": {
    "primary": "<dominant emotion>",
    "secondary": ["<list of other emotions present>"],
    "emotional_intensity": <number between 0 and 1>
  },
  "key_terms": {
    "positive": ["<positive terms>"],
    "negative": ["<negative terms>"],
    "neutral": ["<neutral terms>"]
  },
  "insights": {
    "overall_assessment": "<brief summary>",
    "contextual_factors": ["<factors affecting sentiment>"],
    "recommendations": ["<actionable insights>"]
  }
}

Provide only the JSON response, no additional text.`;
  }

  async analyzeHealthcareSpecific(text) {
    const startTime = Date.now();
    
    try {
      const prompt = `You are a healthcare sentiment analysis specialist. Analyze this text for healthcare-specific sentiment patterns:

TEXT: "${text}"

Focus specifically on:
- Medical terminology and its emotional context
- Treatment adherence and satisfaction
- Symptom reporting and progression
- Healthcare provider relationship sentiment
- Patient empowerment and agency
- Recovery and healing indicators

Return JSON with healthcare-focused analysis:
{
  "medical_sentiment": <-1 to 1>,
  "treatment_satisfaction": <-1 to 1>,
  "symptom_burden": <0 to 1>,
  "provider_relationship": <-1 to 1>,
  "recovery_optimism": <-1 to 1>,
  "adherence_indicators": ["<indicators>"],
  "clinical_insights": ["<insights>"]
}`;

      const response = await axios.post(this.claudeApiUrl, {
        model: this.model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      return {
        ...JSON.parse(response.data.content[0].text),
        processingTime: Date.now() - startTime,
        provider: 'claude-ai'
      };

    } catch (error) {
      logger.error('Claude AI healthcare sentiment analysis failed:', error);
      throw error;
    }
  }

  async analyzeRelationshipDynamics(text) {
    const startTime = Date.now();
    
    try {
      const prompt = `You are a relationship dynamics specialist. Analyze this text for relationship sentiment and dynamics:

TEXT: "${text}"

Focus on:
- Communication patterns and effectiveness
- Emotional support indicators
- Conflict and resolution patterns
- Intimacy and connection levels
- Trust and security indicators
- Partnership and teamwork sentiment

Return JSON:
{
  "relationship_sentiment": <-1 to 1>,
  "communication_effectiveness": <-1 to 1>,
  "emotional_support": <-1 to 1>,
  "conflict_level": <0 to 1>,
  "intimacy_connection": <-1 to 1>,
  "trust_security": <-1 to 1>,
  "partnership_quality": <-1 to 1>,
  "dynamics_insights": ["<insights>"],
  "support_recommendations": ["<recommendations>"]
}`;

      const response = await axios.post(this.claudeApiUrl, {
        model: this.model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      return {
        ...JSON.parse(response.data.content[0].text),
        processingTime: Date.now() - startTime,
        provider: 'claude-ai'
      };

    } catch (error) {
      logger.error('Claude AI relationship analysis failed:', error);
      throw error;
    }
  }

  async detectCrisisIndicators(text) {
    const startTime = Date.now();
    
    try {
      const prompt = `You are a crisis detection specialist for healthcare contexts. Analyze this text for crisis indicators:

TEXT: "${text}"

Look for:
- Suicidal ideation or self-harm references
- Severe mental health crisis indicators
- Medical emergency language
- Relationship crisis or domestic concerns
- Substance abuse crisis indicators
- Extreme emotional distress

Return JSON:
{
  "crisis_level": "<none|low|medium|high|critical>",
  "crisis_type": ["<types of crisis detected>"],
  "specific_indicators": ["<concerning phrases>"],
  "urgency_assessment": "<immediate|within_24h|within_week|monitoring>",
  "recommended_resources": ["<crisis resources>"],
  "safety_plan_needed": <boolean>,
  "professional_intervention": <boolean>
}

Be extremely careful and err on the side of caution for safety.`;

      const response = await axios.post(this.claudeApiUrl, {
        model: this.model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      return {
        ...JSON.parse(response.data.content[0].text),
        processingTime: Date.now() - startTime,
        provider: 'claude-ai'
      };

    } catch (error) {
      logger.error('Claude AI crisis detection failed:', error);
      throw error;
    }
  }

  async analyzeBatch(texts, options = {}) {
    const results = [];
    const batchSize = 5; // Process in smaller batches to avoid rate limits
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => 
        this.analyzeSentiment(text, options).catch(error => ({
          error: 'Analysis failed',
          text: text.substring(0, 50) + '...',
          message: error.message
        }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async generateClinicalInsights(sentimentData, patientContext = {}) {
    const startTime = Date.now();
    
    try {
      const prompt = `You are a clinical AI assistant. Generate actionable clinical insights from this sentiment analysis data:

SENTIMENT DATA:
${JSON.stringify(sentimentData, null, 2)}

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

Generate clinical insights in JSON format:
{
  "clinical_summary": "<brief clinical assessment>",
  "risk_factors": ["<identified risk factors>"],
  "protective_factors": ["<identified protective factors>"],
  "treatment_recommendations": {
    "immediate": ["<immediate actions>"],
    "short_term": ["<1-4 weeks>"],
    "long_term": ["<1+ months>"]
  },
  "monitoring_priorities": ["<what to monitor>"],
  "support_interventions": ["<support recommendations>"],
  "care_team_alerts": ["<important alerts for care team>"],
  "patient_strengths": ["<identified patient strengths>"]
}`;

      const response = await axios.post(this.claudeApiUrl, {
        model: this.model,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      return {
        ...JSON.parse(response.data.content[0].text),
        processingTime: Date.now() - startTime,
        provider: 'claude-ai'
      };

    } catch (error) {
      logger.error('Claude AI clinical insights generation failed:', error);
      throw error;
    }
  }

  generateTextHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Real-time sentiment scoring for live applications
  async getRealtimeSentiment(text) {
    try {
      // Simplified prompt for faster response
      const prompt = `Analyze sentiment: "${text}"
      
      Return only JSON: {"score": <-1 to 1>, "category": "<positive|negative|neutral>", "confidence": <0 to 1>}`;

      const response = await axios.post(this.claudeApiUrl, {
        model: 'claude-3-haiku-20240307', // Faster model for real-time
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      return JSON.parse(response.data.content[0].text);

    } catch (error) {
      logger.error('Real-time sentiment analysis failed:', error);
      throw error;
    }
  }
}

module.exports = new ClaudeAISentimentAnalysisService();