# MatchPro™ Unified v4.0

**Real Estate Intelligence Platform — Fully Independent**

> Zero dependency on Manus. Runs anywhere Node.js runs.

## What is MatchPro?

MatchPro is a B2B real estate intelligence platform that:
- Ingests WhatsApp group messages automatically
- Classifies messages as supply (property listings) or demand (buyer requests) using NLP/AI
- Extracts structured property data (location, price, type, specs) from Arabic & English text
- Matches supply to demand using a 5-factor scoring algorithm
- Notifies brokers and owners of high-confidence matches
- Generates daily Excel reports with analytics
- Provides a full dashboard with market intelligence, broker leaderboards, and CRM pipeline

## Quick Start

### Docker (Recommended)
```bash
cp .env.example .env
# Edit .env with your credentials
docker compose up -d
```

### Manual
```bash
# Prerequisites: Node.js 22+, MariaDB/MySQL 8+
chmod +x scripts/setup.sh
./scripts/setup.sh
pnpm run dev
```

Visit `http://localhost:3000` — create your admin account on first visit.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                  MatchPro Unified v4.0                   │
├────────────────────────────────────────────────────────┤
│  Frontend: React + Vite + TypeScript + Tailwind        │
│  Backend: Express + tRPC + Socket.IO                   │
│  Database: MariaDB/MySQL (via Drizzle ORM)             │
│  Auth: Local JWT + bcrypt (passkey/biometric optional) │
│  NLP: Configurable LLM (OpenAI/Ollama/any compatible) │
│  Messaging: Green API (WhatsApp)                       │
│  Reports: ExcelJS (automated daily + on-demand)        │
│  Storage: Local filesystem (optional S3)               │
└────────────────────────────────────────────────────────┘
```

## Features (Complete List)

### Data Ingestion
- ✅ WhatsApp webhook (Green API) — auto-receives group messages
- ✅ LLM-powered NLP classification (Arabic + English)
- ✅ Rule-based fallback classification (works without LLM)
- ✅ 12-step ingestion pipeline (language → spam filter → classify → extract → normalize → score → route → create → match → notify)
- ✅ Buyer intent classification
- ✅ Spam/irrelevant message filtering

### Matching Engine
- ✅ 5-factor scoring: Property Type (30%), Location (30%), Price (25%), Specs (10%), Amenities (5%)
- ✅ Arabic location normalization (20+ Cairo areas with aliases)
- ✅ Location clustering (nearby area proximity scoring)
- ✅ Price tolerance (±20%)
- ✅ Match summary & explanation generation
- ✅ Auto-matching on ingest

### CRM Pipeline
- ✅ 6 match statuses: new → viewed → contacted → viewing_scheduled → negotiating → closed
- ✅ Contact verification
- ✅ Viewing scheduling
- ✅ Notes per match
- ✅ Qualification status tracking
- ✅ Funnel visualization

### Dashboard & Analytics
- ✅ Real-time dashboard with live feed
- ✅ Executive analytics
- ✅ Market intelligence heatmap
- ✅ Hot zones
- ✅ Investor dashboard
- ✅ Broker leaderboard
- ✅ Supply/demand trends
- ✅ Price analysis by property type
- ✅ Score distribution charts
- ✅ System health widget

### Reports & Exports
- ✅ Multi-sheet Excel reports (demands, supplies, matches, hot matches, area splits)
- ✅ CSV export
- ✅ Automated daily reports (9 AM / 10 PM Cairo time)
- ✅ Email delivery (SMTP)
- ✅ WhatsApp report distribution
- ✅ Area-based export
- ✅ Report history & analytics

### Notifications
- ✅ In-app (bell + badge + dropdown)
- ✅ WebSocket real-time push
- ✅ Email notifications
- ✅ WhatsApp notifications (high-confidence matches)
- ✅ Web Push (VAPID)
- ✅ Custom notification preferences
- ✅ Sound alerts

### User Features
- ✅ My Assets (owned properties)
- ✅ My Requests (buyer requests)
- ✅ Bookmarks
- ✅ Saved searches
- ✅ User profile + intake questionnaire
- ✅ Daily digest
- ✅ Match feedback (1-5 stars)
- ✅ Onboarding flow

### Admin
- ✅ User management
- ✅ Authorized admin emails
- ✅ Audit logs
- ✅ Review queue (approve/reject listings)
- ✅ Version control & feature gating
- ✅ Multi-market config (Real Estate, Jobs, Logistics, Wholesale, Medical)
- ✅ Keywords management
- ✅ Compliance page

### Technical
- ✅ PWA (installable, offline-capable)
- ✅ Dark/light theme
- ✅ Mobile responsive
- ✅ Passkey/biometric authentication
- ✅ WhatsApp OTP login
- ✅ Map integration
- ✅ AI chat box
- ✅ Local file storage + optional S3

## Environment Variables

See `.env.example` for full list. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | MySQL/MariaDB connection string |
| `JWT_SECRET` | ✅ | Secret for signing session tokens |
| `LLM_API_KEY` | Optional | OpenAI/LLM API key (rule-based fallback works without it) |
| `GREEN_API_INSTANCE_ID` | Optional | WhatsApp integration |
| `GREEN_API_TOKEN` | Optional | WhatsApp integration |
| `SMTP_USER` / `SMTP_PASS` | Optional | Email report delivery |

## Data Migration

Existing data from all versions has been extracted to:
```
/matchpro-audit/extracted-data/
├── v3-supply.json (50 records)
├── v3-demand.json (50 records)
├── v3-matches-all.json (100 records)
├── v3-messages.json (50 records)
├── manus-supply.json (5 records)
└── manus-matches.json (25 records)
```

Import with `scripts/migrate-data.sh` after first setup.

## Independence from Manus

| Component | Before | After |
|-----------|--------|-------|
| Auth | Manus OAuth | Local JWT + bcrypt |
| Database | TiDB Cloud (Manus-provisioned) | Self-hosted MariaDB |
| LLM/NLP | Manus Forge API | Any OpenAI-compatible endpoint |
| Notifications | Manus WebDev Service | Local (WebSocket + email + WhatsApp) |
| Storage | Manus S3 | Local filesystem |
| Hosting | Manus platform | Self-hosted (Docker/PM2/any VPS) |

**Result:** MatchPro runs entirely on your own infrastructure. No subscriptions. No platform dependency.

## License

© Crystal Power Investments — Confidential. All rights reserved.
