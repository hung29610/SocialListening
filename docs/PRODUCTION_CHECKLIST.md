# Production Deployment Checklist

Complete checklist for deploying Social Listening Platform to production.

## Pre-Deployment

### Code Review
- [ ] All features tested locally
- [ ] No console.log in production code
- [ ] No hardcoded secrets or API keys
- [ ] Error handling implemented
- [ ] Input validation in place
- [ ] SQL injection prevention verified
- [ ] CORS configured correctly
- [ ] Environment variables documented

### Documentation
- [ ] README.md updated
- [ ] DEPLOYMENT.md complete
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Setup instructions tested

### Local Testing
- [ ] Backend runs without errors
- [ ] Frontend runs without errors
- [ ] Database migrations work
- [ ] Admin user creation works
- [ ] All API endpoints tested
- [ ] All frontend pages load
- [ ] Authentication works
- [ ] CRUD operations work

---

## GitHub Setup

### Repository
- [ ] Create GitHub repository
- [ ] Add .gitignore
- [ ] Remove sensitive files from git
- [ ] Push code to main branch
- [ ] Verify all files pushed
- [ ] Check repository is private (if needed)

### Branch Protection (Optional)
- [ ] Protect main branch
- [ ] Require pull request reviews
- [ ] Require status checks

---

## Render PostgreSQL Setup

### Database Creation
- [ ] Sign up for Render account
- [ ] Create new PostgreSQL database
- [ ] Choose appropriate plan (Free/Starter)
- [ ] Select region (closest to users)
- [ ] Note database name
- [ ] Note username
- [ ] Save Internal Database URL
- [ ] Save External Database URL

### Database Configuration
- [ ] Test connection from local machine
- [ ] Verify database is accessible
- [ ] Check connection limits

### Database Preparation
- [ ] Keep migration files ready
- [ ] Prepare admin user creation script

---

## Render Backend Deployment

### Service Creation
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Select correct repository
- [ ] Choose main branch
- [ ] Set root directory: `backend`
- [ ] Select Python 3 runtime

### Build Configuration
- [ ] Build command: `pip install -r requirements.txt`
- [ ] Start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Choose appropriate plan

### Environment Variables
Add these in Render dashboard:

```env
PYTHON_VERSION=3.11.0
ENVIRONMENT=production
DEBUG=False
LOG_LEVEL=INFO

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# Database (use Internal URL from Render PostgreSQL)
DATABASE_URL=postgresql://user:pass@internal-host/dbname

# Security (generate strong secret)
SECRET_KEY=<generate-strong-random-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Provider
AI_PROVIDER=dummy
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=

# Optional services
REDIS_URL=
TELEGRAM_BOT_TOKEN=
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
```

**Generate SECRET_KEY:**
```python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Deployment
- [ ] Click "Create Web Service"
- [ ] Wait for build to complete
- [ ] Check build logs for errors
- [ ] Verify deployment successful
- [ ] Note deployment URL

### Post-Deployment Verification
- [ ] Visit health endpoint: `https://your-api.onrender.com/health`
- [ ] Visit API docs: `https://your-api.onrender.com/docs`
- [ ] Check logs for errors
- [ ] Verify database connection
- [ ] Verify migrations ran successfully

---

## Vercel Frontend Deployment

### Project Import
- [ ] Sign up for Vercel account
- [ ] Click "Add New Project"
- [ ] Import from GitHub
- [ ] Select SocialListening repository
- [ ] Vercel auto-detects Next.js

### Project Configuration
- [ ] Framework Preset: Next.js (auto-detected)
- [ ] Root Directory: `frontend`
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `.next` (default)
- [ ] Install Command: `npm install` (default)

### Environment Variables
Add in Vercel dashboard:

```env
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

Use your Render backend URL.

### Deployment
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Check build logs for errors
- [ ] Verify deployment successful
- [ ] Note deployment URL

### Post-Deployment Verification
- [ ] Visit frontend URL: `https://your-app.vercel.app`
- [ ] Check for console errors (F12)
- [ ] Verify API calls work
- [ ] Test login page
- [ ] Test dashboard page

---

## CORS Configuration Update

### Update Backend
- [ ] Go to Render backend dashboard
- [ ] Environment variables
- [ ] Update `FRONTEND_URL=https://your-app.vercel.app`
- [ ] Save changes (triggers redeploy)
- [ ] Wait for redeploy to complete
- [ ] Verify CORS working

---

## Production Testing

### Backend API Tests
- [ ] Health check: `GET /health`
- [ ] API docs accessible: `/docs`
- [ ] Login endpoint: `POST /api/auth/login`
- [ ] Get current user: `GET /api/auth/me`
- [ ] List keywords: `GET /api/keywords/groups`
- [ ] List sources: `GET /api/sources`
- [ ] List mentions: `GET /api/mentions`
- [ ] List alerts: `GET /api/alerts`
- [ ] Dashboard data: `GET /api/dashboard`

### Frontend Tests
- [ ] Home page loads
- [ ] Login page loads
- [ ] Can login with credentials
- [ ] Dashboard loads after login
- [ ] Keyword page loads
- [ ] Source page loads
- [ ] Mention page loads
- [ ] Alert page loads
- [ ] Incident page loads
- [ ] No console errors
- [ ] No CORS errors

### End-to-End Tests
- [ ] Create keyword group
- [ ] Add keywords to group
- [ ] Create source (RSS/website)
- [ ] Trigger manual scan
- [ ] View scan job status
- [ ] View mentions (if any)
- [ ] View alerts (if any)
- [ ] Create incident
- [ ] Update incident status
- [ ] Generate report
- [ ] Generate takedown draft

### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] API response time < 1 second
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Images optimized

### Security Tests
- [ ] HTTPS enabled
- [ ] CORS working correctly
- [ ] Authentication required for protected routes
- [ ] JWT tokens working
- [ ] Password hashing working
- [ ] No secrets exposed in frontend
- [ ] No stack traces in production errors

---

## Create Production Admin User

### Option 1: Using Render Shell
```bash
# In Render dashboard, open Shell
python -m app.scripts.create_admin
```

### Option 2: Using API
```bash
# If register endpoint is enabled
curl -X POST https://your-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "strong-password",
    "full_name": "Admin User",
    "is_superuser": true
  }'
```

### Verify Admin User
- [ ] Login with admin credentials
- [ ] Verify admin access
- [ ] Change default password
- [ ] Create additional users if needed

---

## Monitoring Setup

### Render Monitoring
- [ ] Check Render dashboard metrics
- [ ] Review deployment logs
- [ ] Monitor resource usage
- [ ] Set up alerts (if available)

### Vercel Monitoring
- [ ] Check Vercel analytics
- [ ] Review deployment logs
- [ ] Monitor bandwidth usage
- [ ] Check error logs

### Application Monitoring
- [ ] Check application logs
- [ ] Monitor API response times
- [ ] Monitor database connections
- [ ] Monitor error rates

---

## Post-Deployment Tasks

### Documentation
- [ ] Update README with production URLs
- [ ] Document production credentials (securely)
- [ ] Update deployment guide with actual URLs
- [ ] Create runbook for common issues

### Security
- [ ] Change all default passwords
- [ ] Rotate SECRET_KEY if needed
- [ ] Review and update API keys
- [ ] Enable 2FA for admin accounts
- [ ] Review CORS settings
- [ ] Review rate limits

### Backup
- [ ] Setup database backups (Render automatic)
- [ ] Document backup restoration process
- [ ] Test backup restoration
- [ ] Setup monitoring for backup failures

### Performance
- [ ] Review slow queries
- [ ] Optimize database indexes
- [ ] Enable caching if needed
- [ ] Configure CDN if needed

---

## Rollback Plan

### If Deployment Fails

**Backend:**
1. Check Render logs for errors
2. Verify environment variables
3. Check database connection
4. Verify migrations ran
5. Rollback to previous deployment if needed

**Frontend:**
1. Check Vercel logs for errors
2. Verify environment variables
3. Check API URL configuration
4. Rollback to previous deployment if needed

**Database:**
1. Check connection string
2. Verify migrations
3. Rollback migrations if needed: `alembic downgrade -1`

---

## Success Criteria

### Deployment Successful When:
- [ ] Backend API is accessible
- [ ] Frontend is accessible
- [ ] Database is connected
- [ ] Migrations are applied
- [ ] Admin user can login
- [ ] All pages load without errors
- [ ] API calls work from frontend
- [ ] CORS is configured correctly
- [ ] No console errors
- [ ] No server errors

### Application Functional When:
- [ ] Can create keyword groups
- [ ] Can add keywords
- [ ] Can create sources
- [ ] Can trigger manual scan
- [ ] Can view mentions
- [ ] Can view alerts
- [ ] Can create incidents
- [ ] Can generate reports
- [ ] Can generate takedown drafts

---

## Maintenance Tasks

### Daily
- [ ] Check error logs
- [ ] Monitor resource usage
- [ ] Check for failed jobs

### Weekly
- [ ] Review performance metrics
- [ ] Check database size
- [ ] Review security logs
- [ ] Update dependencies if needed

### Monthly
- [ ] Review and optimize queries
- [ ] Clean up old data
- [ ] Review and update documentation
- [ ] Security audit

---

## Emergency Contacts

### Services
- **Render Support**: https://render.com/support
- **Vercel Support**: https://vercel.com/support
- **GitHub Support**: https://support.github.com

### Team
- Product Owner: [Name/Email]
- Tech Lead: [Name/Email]
- DevOps: [Name/Email]
- On-Call: [Name/Phone]

---

## Notes

### Deployment Date
- Date: _______________
- Deployed by: _______________
- Version: _______________

### URLs
- Frontend: _______________
- Backend: _______________
- Database: _______________

### Credentials (Store Securely)
- Admin Email: _______________
- Admin Password: _______________ (change immediately)
- Database Password: _______________
- SECRET_KEY: _______________

---

**Last Updated:** May 9, 2026  
**Version:** 1.0.0
