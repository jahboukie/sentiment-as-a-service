// Vercel API Route for Sentiment Analysis
// Enhanced with comprehensive emotion detection and detailed crisis assessment

const axios = require('axios');

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    console.log('🔍 Vercel API Route - Received request:', {
      method: req.method,
      body: req.body,
      headers: req.headers
    });

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required'
      });
    }

    // Get Claude API key from environment variables
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!claudeApiKey) {
      console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Claude AI API key not configured',
        message: 'Please configure ANTHROPIC_API_KEY environment variable in Vercel'
      });
    }

    console.log('✅ Claude API key found, making analysis request...');

    // Call Claude AI analysis function
    const result = await analyzeWithClaudeAI(text, claudeApiKey);
    
    console.log('✅ Claude AI analysis successful');
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Vercel API Route error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Enhanced Claude AI Analysis Function with Complete Emotion Detection
async function analyzeWithClaudeAI(text, apiKey) {
  const startTime = Date.now();

  const prompt = `Analyze this healthcare text comprehensively and provide detailed clinical insights:

"${text}"

Perform complete sentiment and emotional analysis with context detection. Provide JSON response with:

CONTEXT DETECTION:
- Identify primary context from: veteran_transition, menopause, chronic_illness, pregnancy, relationship_issues, mental_health, substance_use, general_health
- Detect specific indicators for military, healthcare, relationship contexts

COMPREHENSIVE EMOTION ANALYSIS:
Analyze ALL emotions present in the text with intensity scores (0-1) and confidence (0-1). Include:
- Core emotions: isolation, hopelessness, anxiety, fear, sadness, anger
- Complex emotions: frustration, grief, shame, guilt, confusion, overwhelm
- Positive emotions: hope, love, gratitude, relief, determination, peace
- Social emotions: longing, nostalgia, rejection, belonging, trust
- Only include emotions that are actually detected in the text

DETAILED CRISIS ASSESSMENT:
- Risk level assessment with specific risk factors
- Protective factors identification
- Intervention timeline recommendations
- Specific resource recommendations based on context

CONTEXT-SPECIFIC ANALYSIS:
- For veteran contexts: PTSD markers, employment status, military transition indicators
- For relationship contexts: communication patterns, relationship health
- For healthcare contexts: treatment sentiment, symptom management

JSON format:
{
  "context_detection": {
    "primary_context": "<detected_context>",
    "healthcare_domains": ["<relevant_domains>"],
    "military_context": "<detected|not_detected>",
    "confidence": <0-1>
  },
  "sentiment": {
    "score": <-1 to 1>,
    "category": "<positive|negative|neutral|mixed>",
    "confidence": <0-1>
  },
  "emotions": {
    "detected_emotions": {
      "isolation": {"intensity": <0-1>, "confidence": <0-1>},
      "hopelessness": {"intensity": <0-1>, "confidence": <0-1>},
      "anxiety": {"intensity": <0-1>, "confidence": <0-1>},
      "frustration": {"intensity": <0-1>, "confidence": <0-1>},
      "sadness": {"intensity": <0-1>, "confidence": <0-1>},
      "grief": {"intensity": <0-1>, "confidence": <0-1>},
      "shame": {"intensity": <0-1>, "confidence": <0-1>},
      "anger": {"intensity": <0-1>, "confidence": <0-1>},
      "fear": {"intensity": <0-1>, "confidence": <0-1>},
      "love": {"intensity": <0-1>, "confidence": <0-1>},
      "hope": {"intensity": <0-1>, "confidence": <0-1>},
      "relief": {"intensity": <0-1>, "confidence": <0-1>},
      "confusion": {"intensity": <0-1>, "confidence": <0-1>},
      "nostalgia": {"intensity": <0-1>, "confidence": <0-1>},
      "determination": {"intensity": <0-1>, "confidence": <0-1>},
      "longing": {"intensity": <0-1>, "confidence": <0-1>}
    }
  },
  "healthcare_context": {
    "health_trend": "<improving|stable|declining>",
    "treatment_sentiment": "<positive|negative|neutral>",
    "indicators": ["<specific_health_indicators>"]
  },
  "relationship_context": {
    "relationship_health": "<healthy|strained|supportive>",
    "support_level": "<high|medium|low>",
    "communication": "<good|poor|improving|declining>"
  },
  "veteran_context": {
    "applicable": <true|false>,
    "employment_status": "<stable|unstable|unknown>",
    "ptsd_markers": ["<specific_symptoms>"],
    "military_indicators": ["<military_terms_detected>"]
  },
  "crisis_assessment": {
    "risk_level": "<low|medium|medium-high|high>",
    "recommended_action": "<monitoring|professional_support|immediate_intervention>",
    "intervention_timeline": "<ongoing_monitoring|within_week|within_24h|immediate>",
    "immediate_risk_factors": ["<specific_risk_factors>"],
    "protective_factors": ["<specific_protective_factors>"]
  },
  "resources": {
    "immediate": ["<0-24h_resources>"],
    "short_term": ["<1-7_days_resources>"],
    "ongoing": ["<long_term_resources>"]
  },
  "recommendations": ["<specific_actionable_recommendations>"]
}

Important: Only include emotions that are actually detected in the text. Use null or omit emotions not present. Provide specific, context-appropriate resources.`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500, // Increased for comprehensive analysis
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 10000 // Increased timeout for comprehensive analysis
    });

    const content = response.data.content[0].text;
    console.log('Claude AI raw response:', content);

    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Claude AI response:', parseError);
      throw new Error('Invalid JSON response from Claude AI');
    }

    // Format response to match frontend expectations
    return {
      success: true,
      result: {
        contextDetection: {
          primaryContext: analysis.context_detection.primary_context,
          healthcareDomains: analysis.context_detection.healthcare_domains,
          militaryContext: analysis.context_detection.military_context,
          confidence: analysis.context_detection.confidence
        },
        sentiment: {
          score: analysis.sentiment.score,
          category: analysis.sentiment.category,
          confidence: analysis.sentiment.confidence
        },
        emotions: {
          detectedEmotions: analysis.emotions.detected_emotions,
          // Backward compatibility - flatten for frontend display
          ...Object.fromEntries(
            Object.entries(analysis.emotions.detected_emotions || {}).map(([emotion, data]) => [
              emotion, 
              data?.intensity || data // Support both old and new formats
            ])
          )
        },
        healthcareContext: {
          healthTrend: analysis.healthcare_context.health_trend,
          treatmentSentiment: analysis.healthcare_context.treatment_sentiment,
          indicators: analysis.healthcare_context.indicators
        },
        relationshipContext: {
          relationshipHealth: analysis.relationship_context.relationship_health,
          supportLevel: analysis.relationship_context.support_level,
          communication: analysis.relationship_context.communication
        },
        veteranContext: {
          applicable: analysis.veteran_context.applicable,
          employmentStatus: analysis.veteran_context.employment_status,
          ptsdMarkers: analysis.veteran_context.ptsd_markers,
          militaryIndicators: analysis.veteran_context.military_indicators
        },
        crisisAssessment: {
          riskLevel: analysis.crisis_assessment.risk_level,
          recommendedAction: analysis.crisis_assessment.recommended_action,
          interventionTimeline: analysis.crisis_assessment.intervention_timeline,
          immediateRiskFactors: analysis.crisis_assessment.immediate_risk_factors,
          protectiveFactors: analysis.crisis_assessment.protective_factors
        },
        resources: {
          immediate: analysis.resources.immediate,
          shortTerm: analysis.resources.short_term,
          ongoing: analysis.resources.ongoing
        },
        insights: { 
          recommendations: analysis.recommendations 
        },
        processingTime: Date.now() - startTime,
        provider: 'claude-ai-enhanced'
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Claude AI API error:', error.response?.data || error.message);
    console.error('Processing time before error:', processingTime + 'ms');
    
    if (error.code === 'ECONNABORTED' || processingTime > 10000) {
      throw new Error('PROCESSING_TIMEOUT: Analysis took too long');
    } else if (error.response?.status === 503) {
      throw new Error('MODEL_UNAVAILABLE: AI service temporarily unavailable');
    } else if (error.response?.status === 400) {
      throw new Error('INVALID_INPUT: Text format not supported');
    } else {
      throw error;
    }
  }
}