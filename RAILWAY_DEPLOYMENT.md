# MatchPro v10 Unified — Railway Deployment Guide

## Project Details

- **Repository:** `MustafaCrystalPower/matchpro-v10-unified`
- **App Type:** React + Express + TypeScript (Full Stack)
- **Owner Email:** `mmaisara@crystalpowerinvestment.com`

## Deployment Status

✅ **Configuration Files Deployed:**
- ✅ `railway.json` - Railway deployment config
- ✅ `Dockerfile` - Multi-stage production build
- ✅ `.railwayignore` - Build optimization
- ✅ `.env.production` - Production environment template

## Your Live App URL

**Railway will auto-deploy your app at:**
```
https://matchpro-v10-production.railway.app
```

## What Gets Deployed

1. **Build Phase:**
   - Installs dependencies via pnpm
   - Runs `pnpm run build` → outputs to `dist/`
   - Builds both frontend (React/Vite) and backend (Express)

2. **Deploy Phase:**
   - Starts `node dist/index.js` on port 3000
   - Serves full-stack app
   - Railway handles SSL/TLS automatically

## Required Environment Variables (Set in Railway Dashboard)

Go to: https://railway.app and set these in your project's Variables:

```
NODE_ENV=production
JWT_SECRET=<generate-new-secret>
DATABASE_URL=mysql://user:password@host:3306/matchpro
FRONTEND_URL=https://matchpro-v10-production.railway.app
CORS_ORIGIN=https://matchpro-v10-production.railway.app
LOG_LEVEL=info
GREEN_API_TOKEN=<your-whatsapp-token>
SMTP_USER=mmaisara@crystalpowerinvestment.com
SMTP_PASS=<your-app-password>
```

## Database Setup

1. Add MySQL plugin in Railway dashboard
2. Copy the `DATABASE_URL` from Railway's MySQL plugin
3. Paste into your project variables
4. Run migrations: `pnpm run db:migrate`

## Monitor Deployment

1. View logs at: https://railway.app
2. Check deployment status
3. Set up email alerts to `mmaisara@crystalpowerinvestment.com`

## Support

- Railway Docs: https://docs.railway.app
- Contact: mmaisara@crystalpowerinvestment.com