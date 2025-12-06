# SentimentAsAService - Copilot Instructions

## What This Platform Is

A **healthcare-focused sentiment analysis API** powered by Claude AI. Sell API access to:
1. **Sentiment Analysis** - Claude AI with healthcare-specific prompting (`services/claudeAISentimentAnalysis.js`)
2. **Crisis Detection** - Real-time mental health emergency identification
3. **Text Anonymization** - 3 levels: basic, advanced, differential_privacy (`services/anonymization.js`)
4. **Enterprise Infrastructure** - Rate limiting, quotas, usage tracking

### Business Model: API-as-a-Service
- **Free Tier**: 100 calls/day for developers
- **Professional**: $99/month for 10K calls
- **Enterprise**: Custom pricing, unlimited calls, SLA

## Architecture Overview

Node.js/Express API platform running on port 3005 with tiered access.

### Core Data Flow
```
Client Request → Routes → Middleware (auth/security) → Services → Database/Redis/Claude AI
```

### API Tiers
- **Public APIs** (`/api/sentiment`, `/api/analytics`): No auth, basic rate limiting
- **Enterprise APIs** (`/api/enterprise`, `/api/billing`): Require `x-api-key` header
- **Research APIs** (`/api/research`, `/api/clinical`): Enterprise auth + role-based access

## Developer Workflows

### Quick Start
```bash
npm install
cp .env.example .env           # Configure ANTHROPIC_API_KEY for real AI
npm run demo                   # Runs mock mode without DB/Redis
npm run dev                    # Full mode with nodemon (requires Postgres + Redis)
```

### Deployment
```bash
npm run deploy                 # Vercel deployment via deploy-to-vercel.js
```

Demo mode (`start-demo.js`) provides a standalone server with mock responses when Claude AI key is unavailable - useful for frontend development.

## Code Patterns

### Request Validation
All routes use **Joi schemas** for validation. Define schemas at route file top:
```javascript
const schema = Joi.object({
  text: Joi.string().min(1).max(10000).required(),
  includeEmotions: Joi.boolean().default(true)
});
```

### Service Pattern
Services are class-based singletons exported as instances (see `services/`):
```javascript
class MyService { ... }
module.exports = new MyService();
```

### Dual Sentiment Analysis
- `services/claudeAISentimentAnalysis.js` - Claude AI for production (requires `ANTHROPIC_API_KEY`)
- `services/sentimentAnalysis.js` - Local NLP fallback using `natural`/`sentiment`/`compromise` libraries

### Caching Strategy
Redis caching with TTL pattern used throughout:
```javascript
const cached = await redis.getCachedSentimentResult(hash);
if (cached) return cached;
// ... compute result
await redis.cacheSentimentResult(hash, result, 3600);  // 1hr TTL
```

### Healthcare-Specific Sentiment
Custom sentiment dictionaries in `services/sentimentAnalysis.js` with domain-specific weights:
- Positive: `recovery: 5`, `healing: 4`, `remission: 4`
- Negative: `suffering: -5`, `relapse: -5`, `crisis: -4`

## Security & Compliance

### Authentication Layers (`middleware/auth.js`)
- `validateEnterprise` - API key validation with rate limiting
- `validateResearcher` - Role-based research access
- `trackUsage` - Billing/quota tracking middleware

### HIPAA Considerations (`middleware/security.js`)
Security middleware references shared security modules for:
- PHI anonymization before Claude AI calls
- Audit trail logging for all sensitive operations
- Crisis detection with privacy-preserving alerts

### Anonymization Levels (`services/anonymization.js`)
- `basic` - PII pattern replacement
- `advanced` - Healthcare identifier masking
- `differential_privacy` - Statistical noise injection

## Database Schema

PostgreSQL tables (auto-created in `utils/database.js`):
- `sentiment_data` - Core analysis results with `sentiment_score`, `emotional_indicators`
- `enterprise_clients` - API keys, quotas, rate limits per client
- `api_usage` - Billing/usage tracking per request

## Environment Variables

Critical configuration (see `.env.example`):
- `ANTHROPIC_API_KEY` - Enables real Claude AI analysis
- `DB_*` / `REDIS_*` - Database connections
- `JWT_SECRET` - Token signing
- `COST_PER_*` - Billing rates for enterprise usage

## Testing

```bash
npm test  # Jest test runner
```

Manual API testing available at `/api-explorer.html`.

## Known Issues & Tech Debt

### Security Middleware (`middleware/security.js`)
⚠️ **Broken imports**: References non-existent `../../shared/security/*` modules. The security class is defined but will crash on startup. Either:
- Remove the shared security imports and use local implementations
- Or create stub modules if you need HIPAA audit trails

### Outdated Dependencies (Dec 2025 audit)
Major version updates available - consider upgrading:
- `@anthropic-ai/sdk`: 0.24 → 0.71 (breaking changes likely)
- `express`: 4.x → 5.x (major upgrade)
- `stripe`: 14.x → 20.x (API changes)
- `natural`: 6.x → 8.x (NLP library)

Run `npm outdated` for full list. No security vulnerabilities found.

## Target Customers

1. **Telehealth Platforms** - Add sentiment to patient messages
2. **Mental Health Apps** - Crisis detection for chat/journal features  
3. **Patient Engagement Tools** - Analyze feedback and survey responses
4. **EHR Vendors** - Clinical notes sentiment analysis
5. **Crisis Hotlines** - Real-time risk assessment

### Quick Wins to Implement

1. **Add Stripe/usage-based billing** - Your `routes/billing.js` has structure, wire up Stripe
2. **Create developer portal** - Document API with examples, free tier (100 calls/day)
3. **Build case studies** - Run sentiment on public health forums to show value
