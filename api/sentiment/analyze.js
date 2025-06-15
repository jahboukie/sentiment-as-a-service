// Vercel API Route for Sentiment Analysis
// This proxies requests to our Claude AI analysis

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

// Claude AI Analysis Function (copied from start-demo.js)
async function analyzeWithClaudeAI(text, apiKey) {
  const startTime = Date.now();

  const prompt = `Analyze this healthcare text quickly and accurately:

"${text}"

Provide JSON response with:
- Context detection (primary_context, has_military_indicators)
- Sentiment score (-1 to 1), category, confidence
- Key emotions with scores (0-1): isolation, hopelessness, anxiety, frustration, sadness, love, fear, hope
- Healthcare indicators and trend
- Relationship health and support level
- Crisis risk and recommended action
- Veteran context (only if military terms present)
- Brief recommendations

JSON format:
{
  "context_detection": {
    "primary_context": "<menopause|mental_health|chronic_illness|veteran_transition|relationship_issues>",
    "has_military_indicators": <true|false>
  },
  "sentiment_score": <-1 to 1>,
  "sentiment_category": "<positive|negative|neutral|mixed>",
  "confidence": <0 to 1>,
  "emotions": {
    "primary": "<emotion>",
    "detailed_emotions": {
      "isolation": <0-1 or null>,
      "hopelessness": <0-1 or null>,
      "anxiety": <0-1 or null>,
      "frustration": <0-1 or null>,
      "sadness": <0-1 or null>,
      "love": <0-1 or null>,
      "fear": <0-1 or null>,
      "hope": <0-1 or null>
    }
  },
  "healthcare_context": {
    "health_status_trend": "<improving|stable|declining>",
    "treatment_sentiment": "<positive|negative|neutral>"
  },
  "relationship_context": {
    "relationship_health": "<healthy|strained|supportive>",
    "support_level": "<high|medium|low>"
  },
  "veteran_context": {
    "applicable": <true if military terms detected, false otherwise>,
    "employment_status": "<stable|unstable|unknown>",
    "ptsd_markers": ["<symptoms if detected>"]
  },
  "crisis_assessment": {
    "risk_level": "<low|medium|high>",
    "recommended_action": "<monitoring|professional_support|emergency>",
    "resources": ["<key resources>"]
  },
  "recommendations": ["<brief actionable recommendations>"]
}`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 700,
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
      timeout: 8000
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

    return {
      success: true,
      result: {
        contextDetection: analysis.context_detection,
        sentiment: {
          score: analysis.sentiment_score,
          category: analysis.sentiment_category,
          confidence: analysis.confidence
        },
        emotions: analysis.emotions,
        healthcareContext: analysis.healthcare_context,
        relationshipContext: analysis.relationship_context,
        veteranContext: analysis.veteran_context,
        crisisAssessment: analysis.crisis_assessment,
        insights: { recommendations: analysis.recommendations },
        processingTime: Date.now() - startTime,
        provider: 'claude-ai-vercel'
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Claude AI API error:', error.response?.data || error.message);
    console.error('Processing time before error:', processingTime + 'ms');
    
    if (error.code === 'ECONNABORTED' || processingTime > 8000) {
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
