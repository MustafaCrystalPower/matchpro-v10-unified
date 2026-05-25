# MatchPro v10 Unified - Deployment Guide

## 🚀 Railway Deployment Instructions

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Click "Start for free"
3. Sign in with GitHub
4. Grant repository access

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Select `matchpro-v10-unified`
4. Railway will auto-detect the Dockerfile

### Step 3: Add MySQL Database Plugin
1. In your Railway project, click "Add Plugin"
2. Select "MySQL"
3. Railway will auto-generate `DATABASE_URL` environment variable

### Step 4: Configure Environment Variables
Railway dashboard → Variables tab → Add these:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate-with: openssl rand -base64 32>
GREEN_API_ID=7105409203
GREEN_API_TOKEN=<your-token>
FRONTEND_URL=<your-railway-domain>
CORS_ORIGIN=<your-railway-domain>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASS=<app-password>
SMTP_FROM=MatchPro Reports <your-email>
REPORT_EMAIL_TO=<recipient>
REPORT_EMAIL_CC=<cc-recipient>
```

### Step 5: Deploy Database Migrations
After first deployment:
```bash
railway run npm run db:migrate
```

Or through Railway CLI:
```bash
railway login
railway link <your-project-id>
railway run npm run db:migrate
```

### Step 6: Get Railway Token (for GitHub Actions)
1. Go to https://railway.app/account/tokens
2. Create new token
3. Add to GitHub repo: Settings → Secrets → `RAILWAY_TOKEN`

### Step 7: Enable Auto-Deployment
- Push to `master` branch
- GitHub Actions will automatically deploy to Railway
- Check progress in Railway dashboard

## 📊 Deployment Status

Your app will be available at:
`https://<your-project-name>.railway.app`

## 🔒 Security Checklist
- [ ] Generate new `JWT_SECRET`
- [ ] Rotate `GREEN_API_TOKEN` in production
- [ ] Generate Gmail app password
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (Railway auto-enables)
- [ ] Set up database backups
- [ ] Monitor logs in Railway dashboard

## 🐛 Troubleshooting

**Build fails?**
- Check logs in Railway dashboard
- Ensure `Dockerfile` is compatible with Node 22

**App crashes on startup?**
- Verify `DATABASE_URL` is set
- Run migrations: `railway run npm run db:migrate`
- Check logs: `railway logs`

**Database connection error?**
- Wait 30 seconds after adding MySQL plugin
- Verify `DATABASE_URL` format: `mysql://user:pass@host:port/db`

## 📞 Support
- Railway Docs: https://docs.railway.app
- Project Status: Check Railway dashboard
- Logs: Railway dashboard → Deployments tab
