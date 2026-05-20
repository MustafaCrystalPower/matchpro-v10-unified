# MatchPro Railway Deployment & Testing Checklist

## Phase 1: Railway Project Setup

### Create Railway Project
- [ ] Go to railway.app (already logged in as mmaisara)
- [ ] Click "New Project"
- [ ] Select "Deploy from GitHub repo"
- [ ] Select "MustafaCrystalPower/matchpro-dashboard"
- [ ] Click "Deploy"
- [ ] Wait for initial build (5-10 minutes)
- [ ] Note the Railway project URL: `https://matchpro-[random].up.railway.app`

### Add PostgreSQL Database
- [ ] In Railway project, click "+ New"
- [ ] Select "Database" → "Add PostgreSQL"
- [ ] Wait for PostgreSQL service to start
- [ ] Copy `DATABASE_URL` from PostgreSQL variables
- [ ] Format check: `postgresql://postgres:password@host:5432/railway`

---

## Phase 2: Environment Variables Configuration

### Add All Required Variables
Copy these into Railway project settings:

**Database**
- [ ] `DATABASE_URL` = (from PostgreSQL service)

**Node Environment**
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000`

**Authentication**
- [ ] `JWT_SECRET` = (generate: `openssl rand -base64 32`)
- [ ] `OAUTH_SERVER_URL` = `https://api.manus.im`
- [ ] `VITE_OAUTH_PORTAL_URL` = `https://portal.manus.im`
- [ ] `VITE_APP_ID` = (from your Manus project)

**WhatsApp Integration**
- [ ] `GREEN_API_INSTANCE_ID` = (your instance ID)
- [ ] `GREEN_API_TOKEN` = (your API token)

**Manus APIs**
- [ ] `BUILT_IN_FORGE_API_URL` = `https://api.manus.im`
- [ ] `BUILT_IN_FORGE_API_KEY` = (your API key)
- [ ] `VITE_FRONTEND_FORGE_API_URL` = `https://api.manus.im`
- [ ] `VITE_FRONTEND_FORGE_API_KEY` = (your frontend key)

**Owner Information**
- [ ] `OWNER_NAME` = `Moamen Maisara`
- [ ] `OWNER_OPEN_ID` = (your open ID)

**Analytics**
- [ ] `VITE_ANALYTICS_ENDPOINT` = (your analytics endpoint)
- [ ] `VITE_ANALYTICS_WEBSITE_ID` = (your website ID)

**Branding**
- [ ] `VITE_APP_TITLE` = `MatchPro Real Estate Dashboard`
- [ ] `VITE_APP_LOGO` = (your logo URL)

### Verify Variables
- [ ] All 19 variables added
- [ ] No typos in variable names
- [ ] No empty values
- [ ] Click "Deploy" to trigger rebuild with new variables

---

## Phase 3: Deployment Verification

### Monitor Build
- [ ] Watch Railway logs for build progress
- [ ] Check for errors in build output
- [ ] Verify "Build successful" message
- [ ] Verify "Server running on port 3000"

### Access Application
- [ ] Visit Railway URL: `https://matchpro-[random].up.railway.app`
- [ ] Page loads without errors
- [ ] Dashboard visible
- [ ] No console errors in browser

---

## Phase 4: Admin Access Setup

### Set Admin Role
- [ ] Open Railway PostgreSQL Data panel
- [ ] Run this SQL:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'mmaisara@crystalpowerinvestment.com';
  ```
- [ ] Verify query executed successfully
- [ ] Admin user created/updated

### Login as Admin
- [ ] Go to Railway URL
- [ ] Click "Login"
- [ ] Use Manus OAuth with your account
- [ ] Verify dashboard loads
- [ ] Check sidebar for "Admin Dashboard" option (if visible)

---

## Phase 5: Core Features Testing

### Test 1: Match Display with Both Contacts ✓
- [ ] Navigate to "Matches" page
- [ ] Verify matches display
- [ ] Check each match shows:
  - [ ] Supply contact name (SELLER)
  - [ ] Supply contact phone (large, bold, blue)
  - [ ] Demand contact name (BUYER)
  - [ ] Demand contact phone (large, bold, purple)
- [ ] Contacts are clearly visible and not hidden
- [ ] Both contacts on every match

### Test 2: WhatsApp Integration
- [ ] Send test message to WhatsApp group
- [ ] Check "Messages" page in dashboard
- [ ] Verify message appears in "Live Message Feed"
- [ ] Check message classification (supply/demand/unknown)
- [ ] Verify NLP parsing extracted property details
- [ ] Check message timestamp is correct

### Test 3: Broker Analytics Dashboard
- [ ] Navigate to "Analytics" page
- [ ] Click "Broker Leaderboard"
- [ ] Verify broker list displays
- [ ] Check columns: Name, Phone, Supply Count, Demand Count, Successful Matches
- [ ] Verify data is populated (not empty)
- [ ] Click on broker name to see details
- [ ] Check broker stats are accurate

### Test 4: Market Intelligence (Hot Zones)
- [ ] Navigate to "Market Intel" page
- [ ] Click "Hot Zones"
- [ ] Verify locations display with:
  - [ ] Location name
  - [ ] Supply count
  - [ ] Demand count
  - [ ] Market temperature (hot/warm/cool/cold)
  - [ ] Investment score (0-100)
- [ ] Verify data is populated
- [ ] Check sorting by investment score

### Test 5: CSV Export
- [ ] Navigate to "Matches" page
- [ ] Click "Export to CSV"
- [ ] Verify file downloads
- [ ] Open CSV in Excel/Sheets
- [ ] Check columns include:
  - [ ] Supply Contact Name
  - [ ] Supply Contact Phone
  - [ ] Demand Contact Name
  - [ ] Demand Contact Phone
  - [ ] Match Score
  - [ ] Qualification Status
  - [ ] Contact Verified (✓ or ✗)
- [ ] Verify data accuracy matches dashboard

---

## Phase 6: User Onboarding Testing

### Test New User Signup
- [ ] Open incognito/private browser window
- [ ] Visit Railway URL
- [ ] Click "Sign Up" or "Login"
- [ ] Complete OAuth flow
- [ ] New user account created
- [ ] User redirected to dashboard
- [ ] Empty dashboard (no data yet)

### Test User Profile Setup
- [ ] Click "My Profile"
- [ ] Fill in user preferences:
  - [ ] User type (buyer/seller/investor/agent)
  - [ ] Property type preferences
  - [ ] Location preferences
  - [ ] Budget range
  - [ ] Specific requirements
- [ ] Click "Save"
- [ ] Verify profile saved successfully
- [ ] Check user can see personalized matches

### Test User Notifications
- [ ] Create a match that fits user profile
- [ ] Verify notification appears in dashboard
- [ ] Check notification shows:
  - [ ] Both contacts
  - [ ] Match score
  - [ ] Quick action buttons

---

## Phase 7: API & Endpoint Testing

### Admin Testing Dashboard
- [ ] Navigate to admin panel (if available)
- [ ] Test these endpoints:

#### Matches Endpoints
- [ ] `GET /api/trpc/matches.list` - List all matches
  - [ ] Verify response includes matches with both contacts
  - [ ] Check pagination works
  - [ ] Verify contact fields are populated
  
- [ ] `GET /api/trpc/matches.qualified` - List qualified matches only
  - [ ] Verify only qualified matches returned
  - [ ] Check qualification status field
  
- [ ] `POST /api/trpc/matches.qualify` - Qualify a match
  - [ ] Send match ID
  - [ ] Verify match marked as qualified
  - [ ] Check database updated

#### Broker Analytics Endpoints
- [ ] `GET /api/trpc/brokers.topBrokers` - Top brokers list
  - [ ] Verify returns sorted by successful matches
  - [ ] Check broker data includes: name, phone, stats
  
- [ ] `GET /api/trpc/brokers.analytics` - Individual broker stats
  - [ ] Send broker ID
  - [ ] Verify returns broker details and preferences

#### Market Intelligence Endpoints
- [ ] `GET /api/trpc/marketIntel.hotZones` - Hot investment zones
  - [ ] Verify returns locations with investment scores
  - [ ] Check market temperature calculation
  
- [ ] `GET /api/trpc/marketIntel.byLocation` - Location-specific data
  - [ ] Send location name
  - [ ] Verify returns supply/demand ratio, market data

#### User Profile Endpoints
- [ ] `POST /api/trpc/users.updateProfile` - Update user preferences
  - [ ] Send profile data
  - [ ] Verify profile updated
  - [ ] Check personalized matches appear
  
- [ ] `GET /api/trpc/users.profile` - Get user profile
  - [ ] Verify returns current user preferences

#### Notification Endpoints
- [ ] `GET /api/trpc/notifications.list` - List notifications
  - [ ] Verify returns user's notifications
  - [ ] Check read/unread status
  
- [ ] `POST /api/trpc/notifications.markRead` - Mark notification as read
  - [ ] Send notification ID
  - [ ] Verify status updated

---

## Phase 8: Data Accuracy Testing

### Verify Contact Information
- [ ] Check 10 random matches
- [ ] For each match, verify:
  - [ ] Supply contact name is not empty
  - [ ] Supply contact phone is valid format
  - [ ] Demand contact name is not empty
  - [ ] Demand contact phone is valid format
  - [ ] Both contacts are different (not duplicates)

### Verify Match Scoring
- [ ] Check match score calculation
- [ ] Verify location score (0-100)
- [ ] Verify price score (0-100)
- [ ] Verify specs score (0-100)
- [ ] Check overall score is weighted average

### Verify Broker Analytics
- [ ] Count supply messages from each broker
- [ ] Count demand messages from each broker
- [ ] Verify counts match dashboard
- [ ] Check successful matches calculation

---

## Phase 9: Performance Testing

### Load Testing
- [ ] Open dashboard
- [ ] Check page load time (should be < 3 seconds)
- [ ] Navigate between pages
- [ ] Verify no lag or delays
- [ ] Check mobile responsiveness

### Database Performance
- [ ] Check query response times in logs
- [ ] Verify no timeout errors
- [ ] Monitor database connections
- [ ] Check for N+1 query problems

---

## Phase 10: Error Handling Testing

### Test Error Scenarios
- [ ] Send invalid data to API
- [ ] Verify error messages are clear
- [ ] Check error logging in Railway logs
- [ ] Test network disconnection handling
- [ ] Verify graceful error recovery

### Test Edge Cases
- [ ] Match with missing contact info
- [ ] User with no preferences
- [ ] Empty search results
- [ ] Very large CSV export
- [ ] Concurrent user access

---

## Phase 11: Security Testing

### Authentication
- [ ] Verify OAuth flow works
- [ ] Check JWT token validation
- [ ] Test protected routes (should require login)
- [ ] Verify session timeout

### Authorization
- [ ] Admin can access admin features
- [ ] Regular users cannot access admin features
- [ ] Users can only see their own data
- [ ] Verify role-based access control

### Data Protection
- [ ] Verify HTTPS is enabled
- [ ] Check sensitive data is not logged
- [ ] Verify API keys are not exposed
- [ ] Check database credentials are secure

---

## Phase 12: Final Verification

### Checklist Summary
- [ ] All core features working
- [ ] All API endpoints responding correctly
- [ ] Admin access verified
- [ ] New user onboarding works
- [ ] Contacts display correctly on all matches
- [ ] WhatsApp integration functional
- [ ] Broker analytics accurate
- [ ] Market intelligence data populated
- [ ] CSV export includes all required fields
- [ ] No console errors
- [ ] No database errors
- [ ] Performance acceptable
- [ ] Security measures in place

### Sign-Off
- [ ] All tests passed
- [ ] Ready for production use
- [ ] Document any issues found
- [ ] Create follow-up tasks for improvements

---

## Troubleshooting Guide

### Build Fails
**Problem:** Railway build fails
**Solution:**
1. Check Railway logs for specific error
2. Verify all environment variables are set
3. Ensure package.json is correct
4. Try manual rebuild in Railway dashboard

### Database Connection Error
**Problem:** "Failed to connect to database"
**Solution:**
1. Verify DATABASE_URL is correct
2. Check PostgreSQL service is running
3. Verify Drizzle schema matches database
4. Run migrations: `railway run pnpm db:push`

### Features Not Working
**Problem:** Feature appears broken or missing
**Solution:**
1. Check browser console for errors
2. Check Railway logs for server errors
3. Verify environment variables are set
4. Try hard refresh (Ctrl+Shift+R)
5. Clear browser cache

### Admin Access Not Working
**Problem:** Cannot access admin features
**Solution:**
1. Verify user role is 'admin' in database
2. Check user email is correct
3. Try logging out and back in
4. Verify JWT_SECRET is set

---

## Next Steps After Testing

1. **Deploy to Production** - If all tests pass, mark as production-ready
2. **Monitor Performance** - Watch Railway logs for errors
3. **Gather User Feedback** - Get feedback from test users
4. **Iterate and Improve** - Fix any issues found during testing
5. **Document Results** - Create final testing report

---

**Testing Started:** [Date]
**Testing Completed:** [Date]
**Tester:** mmaisara@crystalpowerinvestment.com
**Status:** ☐ PASSED ☐ FAILED ☐ IN PROGRESS
