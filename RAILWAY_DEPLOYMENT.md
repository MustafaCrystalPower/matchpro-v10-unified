# MatchPro Real Estate Dashboard - Railway Deployment Guide

## Overview
This guide provides step-by-step instructions to deploy MatchPro to Railway as a standalone project.

**Stack:** Express.js + React (Vite) + Drizzle ORM + MySQL/PostgreSQL

---

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **GitHub Repository** - Push your code to GitHub
3. **Environment Variables** - Prepare all required secrets

---

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select `matchpro-dashboard` repository
5. Click **"Deploy"**

---

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL instance automatically
4. Copy the `DATABASE_URL` from the PostgreSQL service variables
5. Format: `postgresql://postgres:password@host:5432/railway`

---

## Step 3: Configure Environment Variables

In your Railway project settings, add these environment variables:

### Database
```
DATABASE_URL=postgresql://... (from PostgreSQL service)
```

### Node Environment
```
NODE_ENV=production
PORT=3000
```

### OAuth & Authentication
```
JWT_SECRET=your-secret-key-here (generate with: openssl rand -base64 32)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your-app-id
```

### WhatsApp Integration
```
GREEN_API_INSTANCE_ID=your-instance-id
GREEN_API_TOKEN=your-api-token
```

### Manus Built-in APIs
```
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-key
```

### Owner Information
```
OWNER_NAME=your-name
OWNER_OPEN_ID=your-open-id
```

### Analytics
```
VITE_ANALYTICS_ENDPOINT=your-analytics-endpoint
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

### Application Branding
```
VITE_APP_TITLE=MatchPro Real Estate Dashboard
VITE_APP_LOGO=your-logo-url
```

---

## Step 4: Verify Build Configuration

The `railway.json` file is already configured with:
- **Build Command:** `pnpm install && pnpm build`
- **Start Command:** `pnpm start`

This will:
1. Install dependencies
2. Build the frontend (Vite)
3. Build the backend (Express.js)
4. Start the server on port 3000

---

## Step 5: Deploy

1. Commit and push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add Railway deployment configuration"
   git push origin main
   ```

2. Railway will automatically detect the push and start deployment
3. Watch the deployment logs in Railway dashboard
4. Once deployed, you'll get a public URL: `https://matchpro-[random].up.railway.app`

---

## Step 6: Run Database Migrations

After deployment, run Drizzle migrations:

```bash
# Via Railway CLI
railway run pnpm db:push

# Or manually via dashboard
# Navigate to PostgreSQL → Data → Run SQL
# Execute migration scripts from drizzle/migrations/
```

---

## Step 7: Verify Deployment

1. Visit your Railway URL: `https://matchpro-[random].up.railway.app`
2. Test core features:
   - Login with OAuth
   - View dashboard
   - Check matches display with both contacts
   - Test WhatsApp integration
   - Verify broker analytics

---

## Environment Variables Checklist

- [ ] DATABASE_URL (from PostgreSQL)
- [ ] NODE_ENV=production
- [ ] PORT=3000
- [ ] JWT_SECRET
- [ ] OAUTH_SERVER_URL
- [ ] VITE_OAUTH_PORTAL_URL
- [ ] VITE_APP_ID
- [ ] GREEN_API_INSTANCE_ID
- [ ] GREEN_API_TOKEN
- [ ] BUILT_IN_FORGE_API_URL
- [ ] BUILT_IN_FORGE_API_KEY
- [ ] VITE_FRONTEND_FORGE_API_URL
- [ ] VITE_FRONTEND_FORGE_API_KEY
- [ ] OWNER_NAME
- [ ] OWNER_OPEN_ID
- [ ] VITE_ANALYTICS_ENDPOINT
- [ ] VITE_ANALYTICS_WEBSITE_ID
- [ ] VITE_APP_TITLE
- [ ] VITE_APP_LOGO

---

## Troubleshooting

### Build Fails
- Check Railway logs for specific errors
- Verify all dependencies in `package.json`
- Ensure `pnpm` is available (pre-installed on Railway)

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Ensure Drizzle schema matches database

### Environment Variables Not Loading
- Restart the Railway service after adding variables
- Check variable names have no typos
- Verify values are not empty

### WhatsApp Integration Not Working
- Verify `GREEN_API_INSTANCE_ID` and `GREEN_API_TOKEN`
- Check webhook URL is configured correctly
- Test with real WhatsApp messages

---

## Post-Deployment

### Custom Domain (Optional)
1. In Railway settings, go to **"Domains"**
2. Add your custom domain
3. Update DNS records as instructed
4. Update environment variables if needed

### Monitoring
- Check Railway logs regularly
- Monitor database performance
- Set up error alerts if needed

### Making Changes
1. Make changes locally
2. Test thoroughly
3. Commit and push to GitHub
4. Railway automatically redeploys

---

## Quick Commands

```bash
# Local development
pnpm dev

# Local build test
pnpm build

# View database
pnpm db:studio

# Run tests
pnpm test

# Railway CLI (after installation)
npm i -g @railway/cli
railway login
railway link
railway logs
railway variables
```

---

## Support

- **Railway Docs:** https://docs.railway.app
- **Express.js Docs:** https://expressjs.com
- **Drizzle ORM Docs:** https://orm.drizzle.team
- **Vite Docs:** https://vitejs.dev

---

## Deployment Checklist

- [ ] All tests passing locally
- [ ] Environment variables documented
- [ ] Database schema finalized
- [ ] Build succeeds locally (`pnpm build`)
- [ ] PostgreSQL database created on Railway
- [ ] All environment variables configured
- [ ] railway.json configuration added
- [ ] GitHub repo connected to Railway
- [ ] Deployment successful
- [ ] Database migrations applied
- [ ] Application accessible via Railway URL
- [ ] All features tested (matches, contacts, analytics, WhatsApp)
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up

---

**Your app will be live at:** `https://matchpro-[random].up.railway.app`
