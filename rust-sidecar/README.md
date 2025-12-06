# Sentiment Sidecar 🎰

**RG Check Compliance Engine** - A high-performance Rust service providing automated harm detection for responsible gambling compliance under AGCO Registrar's Standards.

## Why This Exists

Ontario iGaming operators must achieve RG Check accreditation from the Responsible Gambling Council (RGC) to maintain their license. This sidecar provides:

- **Risk Fusion Engine** - Correlate behavioral data (bets, deposits) with emotional data (chat, tickets) in milliseconds
- **Crisis Detection** - Real-time self-harm and distress signals with automatic intervention triggers
- **Audit Vault** - Immutable compliance logs for RG Check auditors
- **Marketing Firewall** - API endpoint preventing promo delivery to distressed players

## Quick Start

```bash
# Build
cargo build --release

# Run (local-only mode, no API key needed)
./target/release/sentiment-sidecar

# Run with Claude AI enhancement
ANTHROPIC_API_KEY=your-key ./target/release/sentiment-sidecar
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness probe |
| `/v1/analyze` | POST | Sentiment analysis (chat/ticket content) |
| `/v1/anonymize` | POST | PII anonymization for audit logs |
| `/v1/crisis/detect` | POST | Crisis/distress detection |
| `/v1/emotions` | POST | Emotion extraction (frustration, anger) |
| `/metrics` | GET | Service metrics |

## RG Check Standards Mapping

| RG Check Standard | Requirement | Sidecar Solution |
|-------------------|-------------|------------------|
| **Standard 4**: Assisting Players | Assistance for players experiencing harm | Auto-Triage: High-distress keywords → Specialized RG Agent |
| **Standard 5**: Informed Decisions | Players enabled to make informed decisions | Contextual Nudges: "Would you like a 24-hour break?" |
| **Standard 6**: Marketing Controls | Don't target vulnerable players | Suppression List: Distressed → Do_Not_Market for 30 days |

## Example Usage

### Detect Chat Frustration
```bash
curl -X POST http://localhost:3030/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "This is rigged! I just lost $500 in 2 minutes, I need that money back!"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "sentiment": {
      "score": -0.85,
      "category": "very_negative",
      "confidence": 0.92
    },
    "emotions": {
      "primary": {"name": "anger", "score": 0.95},
      "secondary": [{"name": "fear", "score": 0.6}]
    },
    "risk_signals": ["chasing_losses", "financial_distress"]
  }
}
```

### Crisis Detection
```bash
curl -X POST http://localhost:3030/v1/crisis/detect \
  -H "Content-Type: application/json" \
  -d '{"text": "I have ruined my life, I used my rent money and now I have nothing"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "assessment": {
      "risk_level": "high",
      "confidence": 0.88,
      "indicators": ["financial_ruin", "hopelessness"],
      "requires_action": true
    },
    "recommended_action": "IMMEDIATE: Route to RG Specialist. Offer self-exclusion options.",
    "suppress_marketing": true,
    "processing_time_ms": 1
  }
}
```

## Integration Patterns

### Modern Stack (Betty, PointsBet, theScore)
```
┌────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                     │
│  ┌──────────────┐    ┌────────────────────────────────┐│
│  │ Chat Service │───▶│ Sentiment Sidecar (Container)  ││
│  └──────────────┘    └────────────┬───────────────────┘│
│                                   │                     │
│                      ┌────────────▼───────────────┐    │
│                      │  CRM (Zendesk/Salesforce)  │    │
│                      │  + Risk Tags               │    │
│                      └────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

### Legacy Enterprise (OLG, IGT, Scientific Games)
```
┌────────────────────────────────────────────────────────┐
│  Strangler Fig Pattern                                  │
│                                                         │
│  User ──▶ [Sidecar Proxy] ──▶ Legacy Backend           │
│               │                                         │
│               ▼                                         │
│  Daily Compliance Audit Report (auto-generated)        │
└────────────────────────────────────────────────────────┘
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3030` | Server port |
| `ANTHROPIC_API_KEY` | - | Claude API key (optional) |
| `LOCAL_ONLY` | `false` | Disable Claude API calls |

## Performance

| Operation | Local Engine | With Claude |
|-----------|-------------|-------------|
| Risk Analysis | < 1ms | ~500ms |
| Crisis Detection | < 1ms | N/A |
| Cache Hit | < 0.1ms | < 0.1ms |

## Revenue Model

- **Pilot**: $2,500/mo (up to 10K players)
- **Operator**: $0.10/player/month (Per-Active-Player-Month)
- **Enterprise**: Custom (on-premise, multi-brand)

**ROI**: Saving one whale from permanent self-exclusion pays for the software annually.

## License

MIT
