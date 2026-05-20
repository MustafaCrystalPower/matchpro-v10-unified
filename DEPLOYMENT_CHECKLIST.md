# Production Deployment Checklist

## Status: READY FOR RAILWAY ✅

All critical fixes applied. This checklist ensures first-attempt success.

---

## STEP 1: Rotate Credentials (Do This First)

**Duration:** 5 minutes
**Blocker:** Yes — do NOT skip this

### Generate New Credentials

```bash
# 1. Generate JWT_SECRET
openssl rand -base64 32
# Save output: ___________________________

# 2. Get new GREEN_API_TOKEN
# Go to: https://console.green-api.com
# Instance 7105409203 → Settings → Generate New Token
# Save token: ___________________________

# 3. Get new SMTP_PASS (Gmail)
# Go to: https://myaccount.google.com/apppasswords
# Select Mail + Windows
# Save password: ___________________________
```

### ✅ Checklist
- [ ] New JWT_SECRET generated (save in secure location)
- [ ] New GREEN_API_TOKEN generated (save in secure location)
- [ ] New SMTP_PASS generated (save in secure location)
- [ ] Verified .env is in .gitignore
- [ ] No credentials visible in recent commits
  ```bash
  git log --oneline | head -5  # Should show: SECURITY & PRODUCTION-READY FIXES
  ```

---

## STEP 2: Create Railway App & Provision MySQL

**Duration:** 3 minutes
**Blocker:** Yes — database must be ready before first deploy

### 1. Create Railway Project
- Go to: https://railway.app
- Click: "New Project"
- Select: "Deploy from GitHub repo"
- Search: `matchpro-v10-unified`
- Click: "Deploy"

**Status:** Build will fail until database is configured (this is normal)

### 2. Add MySQL Database
- In Railway: Click "Create" → "Database" → "MySQL"
- Railway auto-creates and populates `DATABASE_URL`
- ✅ Database ready

### ✅ Checklist
- [ ] Railway project created
- [ ] GitHub repo connected
- [ ] MySQL database provisioned
- [ ] `DATABASE_URL` auto-generated in environment
- [ ] Can see "Created" status on database

---

## STEP 3: Set Production Environment Variables

**Duration:** 2 minutes
**Critical:** Use ONLY the new credentials you just generated

### Go to Railway: Settings → Environment Variables

**Add exactly these variables:**

```env
DATABASE_URL=<already set by MySQL plugin>
NODE_ENV=production
PORT=3000
JWT_SECRET=<your new JWT_SECRET from Step 1>
GREEN_API_ID=7105409203
GREEN_API_TOKEN=<your new GREEN_API_TOKEN from Step 1>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=mmaisara@crystalpowerinvestment.com
SMTP_PASS=<your new SMTP_PASS from Step 1>
REPORT_EMAIL_TO=mmaisara@crystalpowerinvestment.com
REPORT_EMAIL_CC=chadane@crystalpowerexport.com
FRONTEND_URL=https://<your-railway-url>
CORS_ORIGIN=https://<your-railway-url>
FEATURE_V1_CORE=true
FEATURE_V2_MY_ASSETS=true
FEATURE_V3_MY_SEARCH=true
FEATURE_V4_PROPERTY_FINDER=true
FEATURE_V5_DUBIZZLE=true
```

**Important:**
- Replace `<your-railway-url>` with your actual Railway URL (see below)
- Do NOT use old credentials from deployment docs
- Copy EXACTLY as shown

### ✅ Checklist
- [ ] DATABASE_URL is set
- [ ] NODE_ENV=production
- [ ] JWT_SECRET = new value (not old)
- [ ] GREEN_API_TOKEN = new value (not old)
- [ ] SMTP_PASS = new value (not old)
- [ ] All 16+ variables set
- [ ] Saved environment variables in Railway

---

## STEP 4: Trigger Deployment & Get Live URL

**Duration:** 5-10 minutes (automated build)
**Status:** Deploy should complete in 1 attempt now

### 1. Redeploy with New Variables
- In Railway: Click "Deployments"
- Click "Trigger Deploy" (button at top right)
- Watch build progress in logs
- Build should complete with green checkmark

### 2. Get Your Railway URL
- In Railway: Settings → Domains
- Copy your URL (format: `https://matchpro-v10-unified-xxx.railway.app`)
- Update FRONTEND_URL + CORS_ORIGIN in environment variables with actual URL

### ✅ Checklist
- [ ] Deployment triggered
- [ ] Build logs show no errors
- [ ] Build completes with green checkmark
- [ ] Railway URL obtained
- [ ] FRONTEND_URL updated in environment

---

## STEP 5: Test 3 Core Routes

**Duration:** 2 minutes
**Required:** All 3 must pass

### Test 1: Health Check (App is alive)
```bash
curl -I https://<your-railway-url>/api/healthz
# Expected: 200 OK
# Should respond in <50ms
```

### Test 2: Home Page (Frontend loads)
```bash
curl -I https://<your-railway-url>/
# Expected: 200 OK
# Page loads in <2 seconds
```

### Test 3: WebSocket Connection (Real-time ready)
Open browser DevTools Console and run:
```javascript
const ws = new WebSocket('wss://<your-railway-url>/api/socket.io');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.error('❌ Error:', e);
```

### ✅ Checklist
- [ ] /api/healthz returns 200 OK
- [ ] Home page loads successfully
- [ ] WebSocket connects without errors
- [ ] All 3 tests pass

---

## STEP 6: Update Green API Webhook

**Duration:** 1 minute
**Critical:** Without this, WhatsApp messages won't be processed

### 1. Go to Green API Console
- URL: https://console.green-api.com
- Log in
- Instance: 7105409203

### 2. Update Webhook URL
- Settings → Webhook URL
- Enter: `https://<your-railway-url>/api/whatsapp/webhook`
- Click Save

### Expected Behavior
✅ 3,204 queued messages process immediately
✅ New messages process in real-time
✅ Dashboard updates as messages arrive

### ✅ Checklist
- [ ] Logged into Green API console
- [ ] Webhook URL updated to your Railway URL
- [ ] Settings saved
- [ ] Check dashboard for incoming messages
- [ ] Verify 3,204 backlog clears (may take 5-10 min)

---

## SMOKE TESTS

**After all 6 steps complete:**

### Test Dashboard Access
1. Open: `https://<your-railway-url>`
2. Log in with: `demo@matchpro.com` / `MatchPro2026!`
3. Should see:
   - [ ] Home page loads
   - [ ] 3,577+ matches visible
   - [ ] Dashboard shows live data
   - [ ] Real-time updates working

### Test My Assets
1. Click: "My Assets" in sidebar
2. Should see:
   - [ ] 4 properties listed (B7, Privado, Privado Lake, Dreamland)
   - [ ] Total matches showing
   - [ ] Property details visible
   - [ ] Export Excel button works

### Test My Search
1. Click: "My Search" in sidebar
2. Search for: "Madinaty" or "apartment"
3. Should see:
   - [ ] Results appear immediately
   - [ ] Match scores displayed
   - [ ] Contact info visible
   - [ ] WhatsApp links clickable

### Test WhatsApp Integration
1. Send message to monitored WhatsApp group
2. Should appear in dashboard within 2 seconds
3. Should be matched automatically
4. Should see confidence score

### Test Automated Reports
- First report sends at next 6-hour interval
- Check email: mmaisara@crystalpowerinvestment.com
- Should have 8-sheet Excel attachment
- Professional MatchPro branding

---

## Troubleshooting

### Problem: Build fails
**Solution:**
1. Check build logs in Railway → Deployments
2. Most common: missing environment variable
3. Verify DATABASE_URL is set
4. Redeploy with `pnpm db:migrate` added

### Problem: Health check fails (502 or timeout)
**Solution:**
1. Verify /api/healthz endpoint exists (it's new)
2. Check port binding (should use PORT env var)
3. Check logs: Railway → Deployments → View Logs

### Problem: Database migration fails
**Solution:**
1. Verify DATABASE_URL is valid MySQL connection string
2. Check MySQL database is running (Railway shows status)
3. Clear any locks: Stop container and retry

### Problem: WhatsApp messages not arriving
**Solution:**
1. Verify webhook URL is correct (https://, not http://)
2. Verify /api/whatsapp/webhook endpoint is responding (200 OK)
3. Check Green API console for errors
4. Wait up to 5 minutes for backlog to process

### Problem: Emails not sending
**Solution:**
1. Verify SMTP variables are set correctly
2. Check Gmail app password (not regular password)
3. Verify Gmail account has "Less secure apps" enabled
4. Check logs for SMTP errors

---

## Success Indicators ✅

When deployment succeeds, you'll see:

| Indicator | How to Verify |
|-----------|---------------|
| **App loads** | Visit dashboard URL, see home page |
| **Data visible** | See 3,577+ matches on dashboard |
| **My Assets works** | Click sidebar, see your 4 properties |
| **Real-time updates** | New WhatsApp message appears <2s |
| **Reports send** | Email arrives every 6 hours |
| **Healthz works** | `curl /api/healthz` returns 200 |
| **WebSocket live** | Browser console shows connected |

---

## Timeline

| Time | Event |
|------|-------|
| Now | Rotate credentials |
| +5 min | Create Railway app + MySQL |
| +10 min | Set environment variables |
| +20 min | Build completes, URL obtained |
| +25 min | Test all 3 routes |
| +30 min | Update Green API webhook |
| +5 min | Smoke tests |
| **+35 min** | **✅ PRODUCTION LIVE** |

---

## Post-Launch Monitoring

### First 24 Hours
- [ ] Monitor dashboard for errors
- [ ] Check email inbox (reports at 6h intervals)
- [ ] Verify WhatsApp ingestion continues
- [ ] Monitor performance (should be <2s page loads)

### First Week
- [ ] Check automated report quality
- [ ] Monitor matching accuracy (should be >94%)
- [ ] Verify no credential leaks in logs
- [ ] Test failover (pause one scraper, verify others work)

### Ongoing
- [ ] Rotate credentials every 30 days
- [ ] Monitor Railway dashboard for resource usage
- [ ] Archive old reports weekly
- [ ] Review security logs monthly

---

## Emergency Contacts

- **Railway Support:** https://railway.app/docs
- **Green API Support:** https://api.green-api.com/docs
- **GitHub Issues:** https://github.com/MustafaCrystalPower/matchpro-v10-unified/issues
- **Team:** Mo'men +201066505665

---

## Final Verification

Before declaring success:

```bash
# 1. Verify no old credentials in git
git log --all -p | grep -i "matchpro-jwt\|0e7ca429" && echo "❌ FOUND OLD CREDS" || echo "✅ CLEAN"

# 2. Verify .env in gitignore
grep ".env" .gitignore && echo "✅ .env protected" || echo "❌ MISSING"

# 3. Verify latest commit is production fixes
git log -1 --oneline  # Should show: SECURITY & PRODUCTION-READY FIXES
```

**All checks pass?** ✅ **You're production ready!**

---

**Generated:** May 20, 2026
**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT
**Next:** Execute steps 1-6 above in order
