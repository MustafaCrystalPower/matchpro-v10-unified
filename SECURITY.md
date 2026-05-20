# Security & Credential Rotation

## Critical: Rotate Credentials Before Production

**Status:** Credentials were exposed in deployment materials and must be rotated before going live.

### Credentials to Rotate Immediately

| Credential | Old Value | Action | New Value | Service |
|-----------|-----------|--------|-----------|---------|
| JWT_SECRET | matchpro-jwt-secret-v10-crystal-power-2024 | Generate new | `openssl rand -base64 32` | Internal |
| GREEN_API_TOKEN | 0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3 | Rotate | Generate at console.green-api.com | Green API |
| SMTP_PASS | (was in docs) | Rotate | Get new app password | Gmail |

### How to Generate New Credentials

#### 1. JWT_SECRET (32+ characters, random)
```bash
openssl rand -base64 32
# Example output: Z+2K/H8dL9pQ3mX7jY4wN1bC6vF5aS8dT2rE0uG3hJ
```
Copy output to `JWT_SECRET` environment variable in Railway.

#### 2. GREEN_API_TOKEN (new instance token)
1. Go to: https://console.green-api.com
2. Log in with account credentials
3. Select Instance 7105409203
4. Go to Settings → API Token
5. Click "Generate New Token"
6. Copy token and add to Railway as `GREEN_API_TOKEN`

#### 3. SMTP_PASS (Gmail App Password)
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Click "Generate"
4. Copy 16-character password
5. Add to Railway as `SMTP_PASS`

### Deployment Checklist

- [ ] Generate new JWT_SECRET
- [ ] Generate new GREEN_API_TOKEN
- [ ] Generate new SMTP_PASS
- [ ] Add all 3 to Railway environment variables
- [ ] Verify `.env` is in `.gitignore`
- [ ] Verify no credentials in Git history
  ```bash
  git log --all -p | grep -i "token\|secret\|password" | head -20
  ```
- [ ] Run: `pnpm build` locally to verify no build-time errors
- [ ] Deploy to Railway with NEW credentials only
- [ ] Test health check: `curl https://your-railway-url/api/healthz`
- [ ] Test WhatsApp webhook receives messages
- [ ] Verify first report sends to email

### Post-Deployment

1. **Document rotation date**: Add entry to SECURITY.md
2. **Rotate monthly**: Set reminder to rotate credentials every 30 days
3. **Audit logs**: Review Railway logs for any credential leaks
4. **Backup**: Store old credentials securely for 90 days in case of rollback

### Credential Rotation History

| Date | Credential | Action | Reason |
|------|----------|--------|--------|
| 2026-05-20 | JWT_SECRET | Exposed in docs | Pre-production rotation |
| 2026-05-20 | GREEN_API_TOKEN | Exposed in docs | Pre-production rotation |
| 2026-05-20 | SMTP_PASS | Exposed in docs | Pre-production rotation |

### What's NOT Exposed

- ✅ Database credentials (Railway manages)
- ✅ SSH keys (not used)
- ✅ API keys in code (all env vars only)
- ✅ User passwords (hashed with bcryptjs)

### Railway Environment Variables Best Practices

1. **Use Railway Secrets plugin** for sensitive values
2. **Never log credentials** in console output
3. **Scope access** to only team members who need it
4. **Audit access logs** weekly
5. **Delete unused tokens** immediately

### Emergency Procedures

**If credential leaked:**
1. Stop the application (pause Railway deployment)
2. Rotate the compromised credential immediately
3. Review logs for unauthorized access (last 24h)
4. Restart with new credential
5. Document incident in SECURITY.md
6. Notify team members

**If database credential leaked:**
1. Contact Railway support immediately
2. Request new MySQL/PostgreSQL instance
3. Migrate data if needed
4. Update DATABASE_URL in Railway
5. Restart application

### Files & Policies

- `.env` — Never commit (in `.gitignore`)
- `.env.example` — Template only, no real values
- `SECURITY.md` — This file, track all rotations
- `railway.toml` — No secrets (use env vars)
- GitHub repo — Zero credentials in any file or history

### Compliance

- [ ] JWT tokens expire after 1 hour (re-auth required)
- [ ] All HTTPS (Railway auto-manages SSL)
- [ ] Rate limiting enabled (prevent brute force)
- [ ] SQL injection prevention (Drizzle ORM)
- [ ] CORS configured (origin whitelist)
- [ ] Logging does not capture passwords/tokens

---

**REMEMBER:** Production security is non-negotiable. If in doubt, rotate the credential.

For questions: Contact system admin or check Railway documentation.
