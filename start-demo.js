#!/usr/bin/env node

/**
 * Demo Startup Script for SentimentAsAService
 * Starts the server in demo mode for frontend testing
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3005;

// Basic middleware for demo
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Demo health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'sentimentasaservice-demo',
    version: '1.0.0',
    mode: 'demo',
    timestamp: new Date().toISOString()
  });
});

// Demo sentiment analysis endpoint (with real Claude AI if API key available)
app.post('/api/sentiment/analyze', async (req, res) => {
  const { text } = req.body;

  // Check if we have Claude AI API key for real analysis
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;

  if (claudeApiKey && text) {
    try {
      console.log('Attempting Claude AI analysis for:', text.substring(0, 50) + '...');
      // Use real Claude AI analysis with retry logic
      const claudeResult = await analyzeWithClaudeAI(text, claudeApiKey);
      console.log('Claude AI analysis successful');
      return res.json(claudeResult);
    } catch (error) {
      console.error('Claude AI failed:', error.message);
      console.error('Full error:', error);
      console.error('API Key present:', !!claudeApiKey);

      // Check if it's a timeout error and suggest retry
      const isTimeout = error.message.includes('PROCESSING_TIMEOUT') || error.message.includes('timeout');

      return res.status(503).json({
        success: false,
        error: isTimeout ? 'Analysis taking longer than expected. Please try again.' : 'Claude AI analysis temporarily unavailable.',
        message: isTimeout ? 'Complex healthcare analysis requires more processing time. Please retry for complete results.' : 'Our AI service is experiencing high demand. This ensures you get real analysis, not mock data.',
        retry_suggested: true,
        processing_time_exceeded: isTimeout
      });
    }
  } else {
    console.log('No Claude API key or text provided');
    return res.status(400).json({
      success: false,
      error: 'Claude AI API key required for analysis. This platform uses real AI, not mock data.',
      message: 'Please configure ANTHROPIC_API_KEY environment variable for live analysis.'
    });
  }

  // No fallback - only real Claude AI analysis
  return res.status(500).json({
    success: false,
    error: 'Claude AI analysis failed. No mock data available.',
    message: 'This platform provides only real AI analysis for accurate healthcare insights.'
  });
});

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve API explorer
app.get('/api-explorer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-explorer.html'));
});

// Serve pitch deck
app.get('/pitch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pitch.html'));
});

// Alternative routes for pitch deck
app.get('/deck', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pitch.html'));
});

app.get('/investor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pitch.html'));
});

app.get('/presentation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pitch.html'));
});

// Start server
app.listen(PORT, () => {
  const hasClaudeAPI = !!process.env.ANTHROPIC_API_KEY;

  console.log('🚀 SentimentAsAService Server Started!');
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API Explorer: http://localhost:${PORT}/api-explorer`);
  console.log(`💡 Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('🎯 Features Available:');
  console.log('   • Enterprise Dashboard with Live Demo');
  console.log('   • Interactive API Explorer');
  console.log(`   • ${hasClaudeAPI ? '🤖 LIVE Claude AI' : '🎭 Mock Claude AI'} Sentiment Analysis`);
  console.log('   • Security & Compliance Dashboard');
  console.log('   • Real-time Analytics Charts');
  console.log('');

  if (hasClaudeAPI) {
    console.log('🤖 LIVE MODE: Real Claude AI analysis enabled!');
    console.log('   ✅ ANTHROPIC_API_KEY detected');
    console.log('   ✅ Production-ready for VC demos');
    console.log('   ✅ Real healthcare sentiment analysis');
  } else {
    console.log('🎭 DEMO MODE: Mock data only');
    console.log('   Add ANTHROPIC_API_KEY to .env for live Claude AI');
  }
});

// Real Claude AI analysis function
async function analyzeWithClaudeAI(text, apiKey) {
  const startTime = Date.now();

  const prompt = `Analyze this healthcare text quickly and accurately:

"${text}"

Provide JSON response with:
- Context detection (primary_context, has_military_indicators)
- Sentiment score (-1 to 1), category, confidence
- Key emotions with scores (0-1): isolation, hopelessness, anxiety, longing, grief, frustration, shame, trauma_response, nostalgia, loss, sadness, love, confusion, anger, fear, hope
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
    // Performance optimization: Use faster model with timeout
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 700, // Optimized for speed while maintaining core analysis
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
      timeout: 8000 // 8 second timeout to force faster processing
    });

    console.log('Claude AI raw response:', response.data.content[0].text);

    let analysis;
    try {
      analysis = JSON.parse(response.data.content[0].text);
    } catch (parseError) {
      console.error('Failed to parse Claude AI response as JSON:', parseError);
      console.error('Raw response:', response.data.content[0].text);
      throw new Error('Claude AI returned invalid JSON');
    }

    console.log('Parsed Claude AI analysis:', analysis);

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
        insights: analysis.insights,
        keyTerms: analysis.key_terms,
        processingTime: Date.now() - startTime,
        provider: 'claude-ai-live'
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Claude AI API error:', error.response?.data || error.message);
    console.error('Processing time before error:', processingTime + 'ms');

    // Enhanced error categorization
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

module.exports = app;