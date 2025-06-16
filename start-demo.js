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
      // Use real Claude AI analysis
      const claudeResult = await analyzeWithClaudeAI(text, claudeApiKey);
      console.log('Claude AI analysis successful');
      return res.json(claudeResult);
    } catch (error) {
      console.error('Claude AI failed, falling back to mock:', error.message);
      console.error('Full error:', error);
      console.error('API Key present:', !!claudeApiKey);
    }
  } else {
    console.log('No Claude API key or text, using mock data');
  }

  // Fallback to mock analysis for demo
  const mockResult = {
    sentiment: {
      score: Math.random() * 2 - 1,
      category: Math.random() > 0.5 ? 'positive' : 'negative',
      confidence: Math.random() * 0.3 + 0.7
    },
    emotions: {
      primary: 'hope',
      secondary: ['relief', 'gratitude'],
      emotional_intensity: Math.random() * 0.5 + 0.5
    },
    healthcareContext: {
      indicators: [
        {
          term: 'treatment',
          sentiment_impact: 0.4,
          context: 'Medical treatment mentioned positively'
        }
      ],
      health_status_trend: 'improving',
      treatment_sentiment: 'positive'
    },
    relationshipContext: {
      indicators: [
        {
          term: 'support',
          sentiment_impact: 0.3,
          context: 'Support system mentioned'
        }
      ],
      relationship_health: 'healthy',
      support_level: 'high'
    },
    crisisAssessment: {
      risk_level: 'low',
      indicators: [],
      recommended_action: 'monitoring'
    },
    insights: {
      overall_assessment: 'Positive treatment response with good emotional state',
      recommendations: ['Continue current treatment plan']
    },
    processingTime: Math.random() * 500 + 200,
    provider: 'claude-ai-demo'
  };

  res.json(mockResult);
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

  const prompt = `You are an expert sentiment analysis AI specializing in healthcare and relationship contexts. Analyze the following text and provide a comprehensive sentiment analysis.

TEXT TO ANALYZE:
"${text}"

ANALYSIS REQUIREMENTS:
- Focus on healthcare-specific sentiment indicators (symptoms, treatments, recovery, pain, etc.)
- Analyze relationship dynamics (support, communication, conflict, connection, etc.)
- Assess crisis risk level (emergency mental health situations, suicidal ideation, etc.)
- Identify primary emotions present in the text
- Extract key terms and phrases that drive the sentiment

Return your analysis in this exact JSON format:
{
  "sentiment_score": <number between -1 and 1>,
  "sentiment_category": "<positive|negative|neutral|mixed>",
  "confidence": <number between 0 and 1>,
  "emotions": {
    "primary": "<primary emotion>",
    "secondary": ["<emotion1>", "<emotion2>"],
    "emotional_intensity": <number between 0 and 1>
  },
  "healthcare_context": {
    "indicators": [
      {
        "term": "<healthcare term>",
        "sentiment_impact": <number between -1 and 1>,
        "context": "<explanation>"
      }
    ],
    "health_status_trend": "<improving|stable|declining>",
    "treatment_sentiment": "<positive|negative|neutral>"
  },
  "relationship_context": {
    "indicators": [
      {
        "term": "<relationship term>",
        "sentiment_impact": <number between -1 and 1>,
        "context": "<explanation>"
      }
    ],
    "relationship_health": "<healthy|strained|supportive>",
    "support_level": "<high|medium|low>",
    "communication_quality": "<good|fair|poor>"
  },
  "crisis_assessment": {
    "risk_level": "<none|low|medium|high|critical>",
    "indicators": ["<risk indicators if any>"],
    "recommended_action": "<none|monitoring|professional_support|emergency>"
  },
  "insights": {
    "overall_assessment": "<brief clinical assessment>",
    "recommendations": ["<actionable recommendations>"]
  },
  "key_terms": ["<important terms from the text>"]
}`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
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
      }
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
        sentiment: {
          score: analysis.sentiment_score,
          category: analysis.sentiment_category,
          confidence: analysis.confidence
        },
        emotions: analysis.emotions,
        healthcareContext: analysis.healthcare_context,
        relationshipContext: analysis.relationship_context,
        crisisAssessment: analysis.crisis_assessment,
        insights: analysis.insights,
        keyTerms: analysis.key_terms,
        processingTime: Date.now() - startTime,
        provider: 'claude-ai-live'
      }
    };

  } catch (error) {
    console.error('Claude AI API error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = app;