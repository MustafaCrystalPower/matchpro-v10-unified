# MatchPro v10 UNIFIED — Production Deployment Guide

**For:** Mo'men Maisara (Crystal Power Investments)  
**Last Updated:** May 20, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Development Setup](#local-development-setup)
3. [Docker Setup (Recommended)](#docker-setup-recommended)
4. [Railway Deployment](#railway-deployment)
5. [Self-Hosted Deployment](#self-hosted-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance & Monitoring](#maintenance--monitoring)

---

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Node.js 22+ installed (for local development)
- [ ] MySQL/MariaDB 8.0+ (for production)
- [ ] Docker & Docker Compose (for containerized deployment)
- [ ] Railway account (for cloud deployment) OR VPS access
- [ ] Green API instance ID & token (WhatsApp integration)
- [ ] OpenAI API key (or compatible LLM endpoint)
- [ ] SMTP credentials (email delivery)
- [ ] SSL certificate (if self-hosted)

---

## Local Development Setup

### Step 1: Clone & Install

```bash
cd /home/work/.openclaw/workspace/matchpro-v10-unified

# Install dependencies
pnpm install
# or: npm install
```

### Step 2: Configure Environment

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your values
nano .env
```

**Key variables to set:**

```env
# Database (SQLite for dev, MySQL for prod)
DATABASE_URL=sqlite:///./dev.db
# OR for MySQL: DATABASE_URL=mysql://user:pass@localhost:3306/matchpro

# Server
JWT_SECRET=your-secret-key-min-32-chars
PORT=3000
VITE_API_URL=http://localhost:3000

# Green API (WhatsApp)
GREEN_API_INSTANCE_ID=7105409203
GREEN_API_TOKEN=your-token-here

# LLM (OpenAI or compatible)
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin Email
ADMIN_EMAIL=maisaramoamen@outlook.com

# Application
ENVIRONMENT=development
VITE_APP_NAME=MatchPro
```

### Step 3: Initialize Database

```bash
# Run Drizzle migrations
npm run db:push
```

### Step 4: Start Development Server

```bash
# Start backend + frontend (concurrent)
npm run dev

# OR start separately:
# Backend: npm run dev (watches server/)
# Frontend: cd client && npm run dev (watches client/src/)
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- tRPC Playground: http://localhost:3000/trpc-panel (if enabled)

### Step 5: Create Admin User

On first visit to http://localhost:5173:
1. Click "Create Account"
2. Enter email matching `ADMIN_EMAIL` in .env
3. Set password (min 8 chars)
4. Account auto-promoted to admin

---

## Docker Setup (Recommended)

### Step 1: Build Image

```bash
cd /home/work/.openclaw/workspace/matchpro-v10-unified

# Build Docker image
docker build -t matchpro-v10:latest .
```

### Step 2: Configure docker-compose.yml

```bash
# Copy and edit
cp docker-compose.yml docker-compose.prod.yml
nano docker-compose.prod.yml
```

**Key configuration:**

```yaml
version: '3.8'

services:
  mariadb:
    image: mariadb:11.2
    environment:
      MYSQL_ROOT_PASSWORD: root-password-here
      MYSQL_DATABASE: matchpro
      MYSQL_USER: matchpro
      MYSQL_PASSWORD: matchpro-password-here
    ports:
      - "3306:3306"
    volumes:
      - mariadb_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5

  matchpro:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mysql://matchpro:matchpro-password-here@mariadb:3306/matchpro
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
      GREEN_API_INSTANCE_ID: ${GREEN_API_INSTANCE_ID}
      GREEN_API_TOKEN: ${GREEN_API_TOKEN}
      LLM_API_KEY: ${LLM_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    depends_on:
      mariadb:
        condition: service_healthy
    restart: unless-stopped

volumes:
  mariadb_data:
```

### Step 3: Create .env.docker

```bash
cat > .env.docker <<EOF
DATABASE_URL=mysql://matchpro:matchpro-password-here@mariadb:3306/matchpro
JWT_SECRET=your-secret-key-here
GREEN_API_INSTANCE_ID=7105409203
GREEN_API_TOKEN=your-token
LLM_API_KEY=sk-your-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=maisaramoamen@outlook.com
ENVIRONMENT=production
EOF
```

### Step 4: Start Containers

```bash
# Start in background
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f matchpro

# Stop containers
docker compose -f docker-compose.prod.yml down
```

**Access:** http://localhost:3000

---

## Railway Deployment

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up (GitHub recommended)
3. Create new project

### Step 2: Connect Git Repository

1. Click "Create" → "From GitHub Repo"
2. Authorize Railway to access your GitHub
3. Select the repository containing matchpro-v10

### Step 3: Configure Services

**Add Database (MariaDB):**
1. Click "Add Service" → "Database"
2. Select "MySQL"
3. Accept defaults (automatically linked to app)

**Configure Environment Variables:**
1. Go to your project
2. Click on the app service
3. Go to Variables tab
4. Add all from `.env.example`:

```
DATABASE_URL=your-railway-mysql-url (auto-set)
JWT_SECRET=your-secret-min-32-chars
GREEN_API_INSTANCE_ID=7105409203
GREEN_API_TOKEN=your-token
LLM_API_KEY=sk-your-key
LLM_MODEL=gpt-4
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=maisaramoamen@outlook.com
ENVIRONMENT=production
VITE_API_URL=https://your-railway-domain.railway.app
```

### Step 4: Deploy

```bash
# Push to GitHub
git push origin main

# Railway auto-deploys on push
# Check deployment status in dashboard
```

**Access:** https://your-railway-domain.railway.app

### Step 5: Verify Deployment

```bash
# Check logs
railway logs

# Check database
mysql -h your-host -u root -p matchpro

# Test API
curl https://your-railway-domain.railway.app/api/health
```

---

## Self-Hosted Deployment

### Option A: VPS with PM2

#### Step 1: Provision VPS

- Ubuntu 22.04 LTS recommended
- Minimum: 2GB RAM, 20GB disk
- Recommended: 4GB RAM, 50GB disk

#### Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install MariaDB
sudo apt install -y mariadb-server

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install SSL (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
```

#### Step 3: Setup Database

```bash
# Secure MariaDB installation
sudo mysql_secure_installation

# Create database & user
sudo mysql -u root -p <<EOF
CREATE DATABASE matchpro;
CREATE USER 'matchpro'@'localhost' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON matchpro.* TO 'matchpro'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF
```

#### Step 4: Deploy Application

```bash
# Clone repository
cd /home/ubuntu
git clone https://github.com/your-repo/matchpro-v10-unified.git
cd matchpro-v10-unified

# Install dependencies
pnpm install
npm run build

# Setup .env
cp .env.example .env
# Edit with your values
nano .env

# Set DATABASE_URL to local MariaDB:
# DATABASE_URL=mysql://matchpro:strong-password-here@localhost:3306/matchpro

# Run migrations
npm run db:push

# Start with PM2
pm2 start "npm run start" --name "matchpro-v10"
pm2 save
pm2 startup
```

#### Step 5: Setup Nginx Reverse Proxy

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/matchpro <<EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/matchpro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 6: Setup SSL

```bash
# Get SSL certificate
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com

# Update Nginx config (certbot auto-updates it)
sudo systemctl reload nginx
```

#### Step 7: Setup Monitoring

```bash
# Create PM2 startup script
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Create log rotation
sudo tee /etc/logrotate.d/matchpro <<EOF
/home/ubuntu/.pm2/logs/* {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
}
EOF

# Monitor with PM2
pm2 monit
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Via HTTP
curl https://your-domain.com/api/health

# Expected response:
# {"status": "ok", "timestamp": "2026-05-20T..."}
```

### 2. Database Verification

```bash
# Check connection
mysql -h your-host -u matchpro -p matchpro <<< "SELECT COUNT(*) FROM users;"

# Check tables created
mysql -h your-host -u matchpro -p matchpro -e "SHOW TABLES;"
```

### 3. WhatsApp Webhook

```bash
# Verify webhook is registered in Green API dashboard:
# https://console.green-api.com

# Expected URL: https://your-domain.com/api/webhook/whatsapp
```

### 4. Email Test

```bash
# From admin panel:
# Settings → Email Test
# Should receive test email within 10 seconds
```

### 5. Application Test

1. Visit https://your-domain.com
2. Create account (use ADMIN_EMAIL)
3. Log in
4. Check dashboard loads
5. Create test supply/demand
6. Verify matching works
7. Export Excel report
8. Check email delivery

---

## Troubleshooting

### Issue: "Database Connection Failed"

**Symptoms:** App crashes on startup, "ECONNREFUSED" error

**Fix:**
```bash
# Verify database is running
sudo systemctl status mariadb

# Check connection string in .env
echo $DATABASE_URL

# Test connection
mysql -h localhost -u matchpro -p matchpro -e "SELECT 1;"

# Reset connection
npm run db:push
```

### Issue: "Port 3000 Already in Use"

**Symptoms:** "EADDRINUSE: address already in use :::3000"

**Fix:**
```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>

# OR change port in .env
PORT=3001
```

### Issue: "Green API Webhook Not Working"

**Symptoms:** No WhatsApp messages received

**Fix:**
```bash
# Verify webhook URL in Green API console
# Should be: https://your-domain.com/api/webhook/whatsapp

# Test webhook manually
curl -X POST https://your-domain.com/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"messageId":"test123"}'

# Check server logs
pm2 logs matchpro-v10

# Verify GREEN_API_TOKEN in .env is correct
# Get from: https://console.green-api.com
```

### Issue: "Reports Not Sending"

**Symptoms:** No daily emails sent at 9 AM / 10 PM

**Fix:**
```bash
# Check SMTP credentials in .env
# For Gmail: use App Password (not regular password)
# https://myaccount.google.com/apppasswords

# Test email manually
npm run test -- server/dailyEmailService.test.ts

# Check scheduled service
pm2 logs matchpro-v10 | grep "reportService"

# Verify timezone (should be Africa/Cairo)
TZ=Africa/Cairo node -e "console.log(new Date())"
```

### Issue: "High Memory Usage"

**Symptoms:** App consuming >500MB RAM, slow performance

**Fix:**
```bash
# Enable heap snapshots
NODE_OPTIONS="--max-old-space-size=1024" npm run start

# Clear old database records
# DELETE FROM messages WHERE createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY);

# Restart service
pm2 restart matchpro-v10

# Monitor memory
pm2 monit
```

---

## Maintenance & Monitoring

### Daily Tasks

```bash
# Check app health
pm2 status

# Check logs for errors
pm2 logs matchpro-v10 | grep -i error

# Monitor database size
mysql -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb FROM information_schema.tables WHERE table_schema = 'matchpro' ORDER BY (data_length + index_length) DESC;"
```

### Weekly Tasks

```bash
# Backup database
mysqldump -u matchpro -p matchpro > /backups/matchpro-$(date +%Y%m%d).sql

# Check disk space
df -h /

# Review error logs
pm2 logs matchpro-v10 | tail -100
```

### Monthly Tasks

```bash
# Update dependencies
npm update

# Run full test suite
npm test

# Archive old logs
find ~/.pm2/logs -type f -mtime +30 -delete

# Review performance metrics
pm2 status
```

### Backup Strategy

```bash
# Automated daily backup (cron)
0 2 * * * mysqldump -u matchpro -pPASSWORD matchpro > /backups/matchpro-$(date +\%Y\%m\%d).sql

# Keep 30 days of backups
find /backups -name "matchpro-*.sql" -mtime +30 -delete

# Backup uploads directory (if using local storage)
0 3 * * * tar -czf /backups/uploads-$(date +\%Y\%m\%d).tar.gz /home/ubuntu/matchpro-v10-unified/uploads/
```

### Monitoring Stack (Optional)

```bash
# Install PM2 Monitor
pm2 web  # Access at http://localhost:9615

# Or use external monitoring
# - Grafana + Prometheus
# - Datadog
# - New Relic
```

---

## Scaling for Production

### For 10K+ Listings:

```bash
# Enable caching
REDIS_URL=redis://localhost:6379

# Increase database connections
DB_MAX_CONNECTIONS=20

# Add read replica (if using MySQL)
DATABASE_URL=mysql://user:pass@primary:3306/matchpro?replication=true

# Use CDN for static assets
VITE_CDN_URL=https://cdn.your-domain.com

# Enable compression
COMPRESSION_LEVEL=9
```

### For 100+ Concurrent Users:

```bash
# Use PM2 cluster mode
pm2 start "npm run start" --name "matchpro-v10" -i max

# Load balancer (Nginx upstream)
upstream matchpro {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://matchpro;
    }
}
```

---

## Support & Rollback

### Rollback to Previous Version

```bash
# Git rollback
git revert HEAD
git push origin main

# PM2 rollback
pm2 revert

# Database rollback (from backup)
mysql matchpro < /backups/matchpro-20260519.sql
```

### Get Help

- Check logs: `pm2 logs matchpro-v10`
- Read docs: See MATCHPRO_v10_BUILD_PLAN.md
- Email support: maisaramoamen@outlook.com
- Review code: /home/work/.openclaw/workspace/matchpro-v10-unified/

---

## Final Checklist

- [ ] Database running and accessible
- [ ] Environment variables set correctly
- [ ] Migrations ran successfully
- [ ] Admin user created
- [ ] WhatsApp webhook configured
- [ ] Email service tested
- [ ] SSL certificate active
- [ ] Health endpoint responding
- [ ] All tests passing
- [ ] Backups configured
- [ ] Monitoring setup
- [ ] Team notified of deployment

---

**Deployment Complete! 🚀**

Your MatchPro v10 UNIFIED instance is ready for production.

**Questions?** Check MATCHPRO_v10_BUILD_PLAN.md or contact support.

