# MatchPro v10 UNIFIED — Build Plan & Integration Strategy

**Status:** In Progress  
**Target:** Complete, production-ready, single codebase  
**Deadline:** May 20, 2026 (TODAY)

---

## Phase Overview

### Phase 1: Foundation Audit (✅ STARTED)
- Identify base structure (v9 → matchpro-unified)
- Catalog v2 live DB (4K supply, 7.6K demand, 56K matches)
- Identify v2, ultimate, and mega features to merge
- Understand current test coverage

### Phase 2: Core Feature Merge (🔄 IN PROGRESS)
- Port proven matching algorithm from v2
- Integrate NLP extraction engine (context-aware Arabic parsing)
- Add platform scrapers (Property Finder, Dubizzle, Facebook)
- Wire up My Assets feature with real DB
- Wire up My Search feature with real matching
- Add client vs broker differentiation

### Phase 3: Version Manager & Feature Gating
- Build admin UI for v1-10 feature activation
- Create version control system (v1 core always on, v2+ toggleable)
- Implement feature-gate middleware

### Phase 4: Quality Assurance
- Unit tests (≥100 passing)
- Integration tests (real data matching)
- E2E tests (WhatsApp → match → notify flow)
- Railway deployment config
- Complete .env.example

### Phase 5: Documentation & Delivery
- Complete DEPLOY.md with step-by-step instructions
- Final checklist (✅/🔴)
- Architecture diagram (ASCII)
- Known issues + fixes list
- README update with v10 stats

---

## Current State Analysis

### matchpro-v10-unified (Base from v9)
**Directory:** `/home/work/.openclaw/workspace/matchpro-v10-unified/`  
**Size:** ~600 MB (includes node_modules)  
**Includes:**
- React + Vite frontend (50+ pages planned)
- Express + tRPC backend
- Drizzle ORM with MySQL/MariaDB
- Schema: users, organizations, messages, supply, demand, matches, assets, etc.
- Matching engine (matchingEngine.ts) — 5-factor scoring
- NLP parser (nlpParser.ts) — Arabic extraction
- Broker detection (brokerDetection.ts)
- Reports system (excelReportGenerator.ts, scheduledReportService.ts)
- WhatsApp integration (whatsapp.ts via Green API)
- Notifications (notificationService.ts, webPushService.ts)
- Authentication (JWT + passkeys)
- Tests: 163+ tests passing

**Status:** STABLE — Running on port 3070 in production (matchpro-unified)

### matchpro-v2 (Live DB)
**Directory:** `/home/work/.openclaw/workspace/matchpro-v2/`  
**Size:** 50 MB  
**Active Data:**
- supply: 4,000+ verified listings
- demand: 7,626+ buyer requests
- matches: 56,566+ scored pairs
- Messages: 5,573+ WhatsApp messages

**Scrapers (NOT YET INTEGRATED INTO v10):**
- `aqarmap_scraper.py` — Aqarmap listings (Python-based)
- `olx_scraper.py` — OLX Egypt listings
- `run_public_scrapers.py` — Facebook + public sources

**Status:** ACTIVE PRODUCTION — Do NOT delete. Data feeds v10.

### matchpro-ultimate (Enterprise Features)
**Directory:** `/home/work/.openclaw/workspace/matchpro` (674 MB)  
**Notable Features:**
- Advanced NLP pipeline
- Broker detection + scoring
- Investor dashboard
- Market intelligence heatmap
- Advanced AVM (automated valuation)

**Status:** Reference architecture — code review needed before porting.

---

## v10 Build Checklist

### TIER 1: Core Platform (Already in v9)
- [x] Supply + Demand tables & CRUD
- [x] Matching algorithm (5-factor scoring)
- [x] WhatsApp ingestion (Green API webhook)
- [x] NLP-based classification (Arabic + English)
- [x] Match notifications
- [x] Dashboard with analytics
- [x] Excel report generation
- [x] Scheduled report service
- [x] User authentication (JWT + passkeys)
- [x] CRM pipeline (match statuses)
- [x] Admin panel (user mgmt, audit logs)

### TIER 2: User Features (CRITICAL — Need Full Integration)
- [ ] **My Assets** — Add/manage owned properties
  - [x] Database schema (assets table exists)
  - [ ] Frontend: create/edit/delete pages
  - [ ] Auto-matching against market demand
  - [ ] Client vs Broker detection
  - [ ] WhatsApp contact integration
  - [ ] CRM notes + follow-up tracking
  - [ ] Excel export
- [ ] **My Search** — User-defined searches
  - [x] Database schema (savedSearches router exists)
  - [ ] Frontend: search builder UI
  - [ ] Real-time results from all supply
  - [ ] Saved search filters
  - [ ] Match notifications on new matches
  - [ ] Excel export

### TIER 3: Platform Connectors (NEW — Not in v9)
- [ ] **Property Finder Egypt Scraper**
  - Node.js (cheerio-based, not Python)
  - Schedule: Every 6 hours
  - Expected: 200+ listings per run
  - Fields: type, location, price, beds, baths, size, contact
  
- [ ] **Dubizzle Egypt Scraper**
  - Node.js (cheerio-based)
  - Schedule: Every 6 hours
  - Expected: 150+ listings per run
  
- [ ] **Facebook Groups Connector**
  - Graph API (preferred) + fallback scraper
  - Real Estate Egypt group + regional groups
  - Expected: 100+ posts per run
  
- [ ] **Aqarmap + OLX Scrapers** (migrate from v2 Python)
  - Adapt v2 Python scrapers to Node.js OR keep Python + cron bridge
  - Expected: 300+ combined listings per run

### TIER 4: Version Manager (NEW)
- [ ] Admin UI for feature gating
- [ ] Backend middleware for version checks
- [ ] Database table: `featureVersions`
- [ ] Activation flags:
  - v1 (core matching) — ALWAYS ON ✅
  - v2 (My Assets) — default ON
  - v3 (My Search) — default ON
  - v4 (Property Finder) — default OFF
  - v5 (Dubizzle) — default OFF
  - v6 (Facebook) — default OFF
  - v7-10 (reserved) — default OFF

### TIER 5: Security & Compliance
- [ ] Zero Green API exposure in UI (server logs only)
- [ ] UI labels: "MatchPro Connect" (not "Green API")
- [ ] All credentials in .env (never hardcoded)
- [ ] .env.example complete
- [ ] SQL injection prevention (Drizzle handles this ✅)
- [ ] CORS properly configured

### TIER 6: Deployment Ready
- [ ] SQLite local DB option (for dev)
- [ ] MySQL/MariaDB for production
- [ ] Railway deployment config (Dockerfile + compose)
- [ ] Drizzle migrations automated
- [ ] Health check endpoint
- [ ] Graceful shutdown handling
- [ ] Environment validation on startup

### TIER 7: Testing
- [ ] Unit tests: ≥100 passing (currently 163+)
- [ ] Integration tests: Matching algorithm with real data
- [ ] E2E tests: Full flow (WhatsApp → parse → match → notify)
- [ ] Scraper tests: Mock API responses
- [ ] Reporter tests: Excel generation validation

---

## v10 Deliverables

### Code Changes
1. **New Scrapers** (`/scrapers/`)
   - `propertyFinder.ts` — Cheerio-based scraper
   - `dubizzle.ts` — Cheerio-based scraper
   - `facebook.ts` — Graph API + fallback scraper
   - `scheduledScraperService.ts` — Cron orchestration

2. **User Features** (`/client/src/pages/` + `/server/routers/`)
   - `MyAssets.tsx` — Asset management page
   - `MySearch.tsx` — Search builder page
   - `assets.ts` router — CRUD + auto-matching logic
   - `search.ts` router — Saved searches logic

3. **Version Manager** (`/server/versionManager.ts` + `/client/pages/Admin/VersionManager.tsx`)
   - Admin UI: Feature activation toggles
   - Backend: Gate checks on routes

4. **Enhanced Matching** (`/server/enhancedMatchingEngine.ts`)
   - Score weighting adjustments
   - Broker detection integration
   - Confidence scoring improvements

5. **Documentation**
   - `MATCHPRO_v10_UNIFIED_README.md` — Complete feature checklist + architecture
   - `DEPLOY.md` — Step-by-step production deployment
   - Updated `.env.example`

### Data
- Export existing 56K+ matches for v10 validation
- Prepare v2 data migration scripts
- Create seed data for testing

### Testing Output
- `TEST_REPORT_v10.md` — All test results
- Coverage metrics
- Known issues + workarounds

---

## Integration Strategy

### Why v10 Works
1. **Single Codebase** — No juggling multiple repos. Everything in v10.
2. **Proven Base** — v9 is in production (port 3070). We're extending, not rewriting.
3. **Live Data Ready** — v2 has 56K matches. Immediate value demonstration.
4. **Modular** — Version gates mean users see exactly what they need.
5. **Production Grade** — Drizzle ORM, Drizzle migrations, Zod validation, error handling.

### Migration from v2
```
v2 SQLite                    v10 MySQL/MariaDB
├─ supply (4K)         →     supply table (import + new scrapers)
├─ demand (7.6K)       →     demand table (import + new webhooks)
├─ matches (56K)       →     matches table (import + re-validate)
└─ messages (5.5K)     →     messages table (import)
```

### Deployment Path
```
Local Dev (SQLite) → Testing (MariaDB) → Railway (MySQL) → Production
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Scraper failures | Fallback to rule-based matching; separate scraper service |
| Green API rate limits | Queue system + exponential backoff; local caching |
| Data duplication | Deduplication engine (phone + property fingerprint) |
| Performance degradation | Caching layer; indexed queries; background jobs |
| Missing features in My Assets | Feature flag = disabled by default; enables when ready |

---

## Success Criteria

✅ **CORE:** Supply + Demand + Matching + Notifications working in v10  
✅ **CRITICAL:** My Assets feature live with auto-matching  
✅ **CRITICAL:** My Search feature live with saved filters  
✅ **NICE-TO-HAVE:** At least 2 platform scrapers (Property Finder + Dubizzle)  
✅ **PRODUCTION:** Version manager + feature gates implemented  
✅ **DEPLOYMENT:** Railway config ready + DEPLOY.md complete  
✅ **TESTING:** 100+ tests passing + integration tests with real data  
✅ **DOCUMENTATION:** Complete README + API endpoints documented  

---

## Timeline

| Phase | Tasks | Est. Hours | Status |
|-------|-------|-----------|--------|
| 1 | Audit + planning | 2 | ✅ Done |
| 2 | Core merge + My Assets | 6 | 🔄 In Progress |
| 3 | My Search + Scrapers | 4 | 🔄 Next |
| 4 | Version Manager | 2 | ⏳ Queued |
| 5 | Testing + fixes | 3 | ⏳ Queued |
| 6 | Deployment + docs | 2 | ⏳ Queued |
| **TOTAL** | — | **19 hours** | — |

**Target Completion:** May 20, 2026 @ 6 PM UTC

---

## File Manifest (Expected)

```
matchpro-v10-unified/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── MyAssets.tsx ✨ NEW
│       │   ├── MySearch.tsx ✨ NEW
│       │   └── Admin/
│       │       └── VersionManager.tsx ✨ NEW
│       └── ...
├── server/
│   ├── scrapers/
│   │   ├── propertyFinder.ts ✨ NEW
│   │   ├── dubizzle.ts ✨ NEW
│   │   ├── facebook.ts ✨ NEW
│   │   ├── scheduledScraperService.ts ✨ NEW
│   │   └── index.ts (orchestrator)
│   ├── routers/
│   │   ├── assets.ts (enhanced)
│   │   ├── savedSearches.ts (enhanced)
│   │   └── versionManager.ts ✨ NEW
│   ├── enhancedMatchingEngine.ts ✨ NEW
│   ├── versionManager.ts ✨ NEW
│   ├── matchingEngine.ts (unchanged)
│   ├── nlpParser.ts (unchanged)
│   └── ...
├── drizzle/
│   └── migrations/
│       ├── add-version-manager.sql ✨ NEW
│       ├── add-assets-enhancements.sql ✨ NEW
│       └── ...
├── .env.example (enhanced)
├── MATCHPRO_v10_UNIFIED_README.md ✨ NEW
├── DEPLOY.md ✨ NEW
├── TEST_REPORT_v10.md ✨ NEW
└── docker-compose.yml (unchanged, but tested)
```

---

## Questions for Mo'men (if needed)

1. **Scraper Priority:** Which platform first? Property Finder, Dubizzle, or Facebook?
   - *Recommendation:* Property Finder (highest quality, most standardized)

2. **Update Frequency:** How often should scrapers run?
   - *Recommendation:* Every 6 hours (4x daily)

3. **Data Retention:** Keep old v2 data or migrate fresh?
   - *Recommendation:* Import historical 56K matches + continue scraping new

4. **My Assets Rollout:** Full feature now or phased?
   - *Recommendation:* Full (v2 flag = enabled, but backend-gated)

5. **Broker Detection:** Mandatory or optional?
   - *Recommendation:* Enabled by default (can be toggled in version manager)

---

**Last Updated:** May 20, 2026 10:15 UTC  
**Next Step:** Begin Phase 2 (Feature Merge)
