// Vercel API Health Check
export default function handler(req, res) {
  const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    claude_api_configured: hasClaudeKey,
    api_endpoints: {
      sentiment_analyze: '/api/sentiment/analyze',
      health: '/api/health'
    },
    message: hasClaudeKey 
      ? 'All systems operational' 
      : 'Claude AI API key not configured - please add ANTHROPIC_API_KEY to Vercel environment variables'
  });
}
