#!/usr/bin/env node

/**
 * Demo Startup Script for SentimentAsAService
 * Starts the server in demo mode for frontend testing
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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

// Demo sentiment analysis endpoint
app.post('/api/sentiment/analyze', (req, res) => {
  const { text } = req.body;
  
  // Simple mock analysis for demo
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

// Start server
app.listen(PORT, () => {
  console.log('🚀 SentimentAsAService Demo Server Started!');
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API Explorer: http://localhost:${PORT}/api-explorer`);
  console.log(`💡 Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('🎯 Features Available:');
  console.log('   • Enterprise Dashboard with Live Demo');
  console.log('   • Interactive API Explorer');
  console.log('   • Mock Claude AI Sentiment Analysis');
  console.log('   • Security & Compliance Dashboard');
  console.log('   • Real-time Analytics Charts');
  console.log('');
  console.log('🔒 Note: Running in DEMO mode - mock data only');
  console.log('   Add ANTHROPIC_API_KEY to .env for live Claude AI');
});

module.exports = app;