# Social Listening Platform - Deployment Guide

Complete guide for local development and production deployment without Docker.

## Table of Contents

1. [Overview](#overview)
2. [Local Development Setup (Windows)](#local-development-setup-windows)
3. [PostgreSQL Local Setup](#postgresql-local-setup)
4. [Backend Local Run](#backend-local-run)
5. [Frontend Local Run](#frontend-local-run)
6. [GitHub Setup](#github-setup)
7. [Render PostgreSQL Setup](#render-postgresql-setup)
8. [Render Backend Deployment](#render-backend-deployment)
9. [Vercel Frontend Deployment](#vercel-frontend-deployment)
10. [Environment Variables](#environment-variables)
11. [CORS Setup](#cors-setup)
12. [Alembic Migration Commands](#alembic-migration-commands)
13. [Production Test Checklist](#production-test-checklist)
14. [Common Errors and Fixes](#common-errors-and-fixes)

---

## Overview

**Architecture:**
- **Frontend**: Next.js deployed to Vercel
- **Backend**: FastAPI deployed to Render Web Service
- **Database**: PostgreSQL (local for dev, Render Managed for production)
- **No Docker**: Direct installation on Windows for local development

**Tech Stack:**
- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- Backend: FastAPI, SQLAlchemy, Alembic, Pydantic
- Database: PostgreSQL
- AI: Pluggable providers (OpenAI, Gemini, DeepSeek, Dummy)

---

## Local Development Setup (Windows)

### Prerequisites

Install these on your Windows machine:

1. **Python 3.11+**
   - Download: https://www.python.org/downloads/
   - ✅ Check "Add Python to PATH" during installation
   - Verify: `python --version`

2. **Node.js 18+**
   - Download: https://nodejs.org/
   - Choose LTS version
   - Verify: `node --version` and `npm --version`

3. **PostgreSQL 14+**
   - Download: https://www.postgresql.org/download/windows/
   - During installation:
     - Password: `123456` (or remember your password)
     - Port: `5432` (default)
     - Locale: Default
   - Verify: `psql --version`

4. **Git**
   - Download: https://git-scm.com/download/win
   - Verify: `git --version`

### Clone Repository

```cmd
cd /d "%USERPROFILE%\OneDrive\Máy tính"
git clone https://github.com/yourusername/SocialListening.git
cd SocialListening
```

---

## PostgreSQL Local Setup

### Option 1: Using Installed PostgreSQL

**Start PostgreSQL Service:**

```cmd
REM Method 1: Using Services
Win + R → services.msc → Find "postgresql" → Right click → Start

REM Method 2: Using Command Line (as Administrator)
net start postgresql-x64-16
```

**Check PostgreSQL is Running:**

```cmd
pg_isready -U postgres
```

Expected output: `accepting connections`

**Create Database:**

```cmd
REM Connect to PostgreSQL
psql -U postgres

REM In psql prompt:
CREATE DATABASE social_listening;
\q
```

**Or use createdb command:**

```cmd
createdb -U postgres social_listening
```

### Option 2: Using Portable PostgreSQL

If you have portable PostgreSQL in `pgsql` folder:

```cmd
cd /d "%USERPROFILE%\OneDrive\Máy tính\pgsql\bin"

REM Start PostgreSQL
pg_ctl.exe -D ..\data -l "%USERPROFILE%\Desktop\pg_log.txt" start

REM Check status
pg_isready.exe -U postgres

REM Create database
createdb.exe -U postgres social_listening
```

### Set PostgreSQL to Auto-Start

To avoid manual start every time:

1. Win + R → `services.msc`
2. Find "postgresql-x64-16" (or your version)
3. Right click → Properties
4. Startup type: **Automatic**
5. Click OK

---

## Backend Local Run

### 1. Navigate to Backend Directory

```cmd
cd /d "%USERPROFILE%\OneDrive\Máy tính\SocialListening\backend"
```

### 2. Create Virtual Environment (First Time Only)

```cmd
python -m venv venv
```

### 3. Activate Virtual Environment

```cmd
.\venv\Scripts\activate
```

You should see `(venv)` in your command prompt.

### 4. Install Dependencies

```cmd
pip install -r requirements.txt
```

### 5. Configure Environment Variables

Create or edit `backend/.env`:

```env
# App Configuration
APP_NAME=Social Listening Platform
ENVIRONMENT=development
DEBUG=True
LOG_LEVEL=INFO

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Database (PostgreSQL local)
DATABASE_URL=postgresql://postgres:123456@localhost:5432/social_listening

# JWT Security
SECRET_KEY=your-very-long-random-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Provider (dummy for local testing)
AI_PROVIDER=dummy
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
```

**Important:** Change `123456` to your PostgreSQL password.

### 6. Run Database Migrations

```cmd
alembic upgrade head
```

This creates all database tables.

### 7. Create Admin User (First Time Only)

```cmd
python -m app.scripts.create_admin
```

Default credentials:
- Email: `admin@example.com`
- Password: `admin123`

### 8. Start Backend Server

```cmd
uvicorn app.main:app --reload
```

Backend will run at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

**Keep this terminal open.**

---

## Frontend Local Run

### 1. Open New Terminal

Open a new Command Prompt window.

### 2. Navigate to Frontend Directory

```cmd
cd /d "%USERPROFILE%\OneDrive\Máy tính\SocialListening\frontend"
```

### 3. Install Dependencies (First Time Only)

```cmd
npm install
```

This may take 5-10 minutes.

### 4. Configure Environment Variables

Create or edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5. Start Frontend Server

```cmd
npm run dev
```

Frontend will run at: http://localhost:3000

**Keep this terminal open.**

### 6. Access Application

Open browser: http://localhost:3000

Login:
- Email: `admin@example.com`
- Password: `admin123`

---

## GitHub Setup

### 1. Create .gitignore

Ensure `.gitignore` includes:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv

# Node
node_modules/
.next/
out/
build/
dist/

# Environment
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite
*.sqlite3

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# PostgreSQL portable
pgsql/data/

# Misc
*.xlsx
*.pdf
```

### 2. Initialize Git (if not already)

```cmd
git init
git add .
git commit -m "Initial commit"
```

### 3. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `SocialListening`
3. Private or Public
4. Do NOT initialize with README (we already have code)
5. Click "Create repository"

### 4. Push to GitHub

```cmd
git remote add origin https://github.com/yourusername/SocialListening.git
git branch -M main
git push -u origin main
```

---

## Render PostgreSQL Setup

### 1. Create Render Account

Go to https://render.com and sign up.

### 2. Create PostgreSQL Database

1. Click "New +" → "PostgreSQL"
2. Name: `social-listening-db`
3. Database: `social_listening`
4. User: `social_listening_user` (auto-generated)
5. Region: Choose closest to your users
6. Plan: **Free** (for testing) or **Starter** (for production)
7. Click "Create Database"

### 3. Get Database Connection String

After creation, you'll see:
- **Internal Database URL**: Use this for Render services
- **External Database URL**: Use this for local testing

Example:
```
postgresql://social_listening_user:password@dpg-xxxxx.oregon-postgres.render.com/social_listening
```

**Save this URL** - you'll need it for backend deployment.

### 4. Test Connection (Optional)

From your local machine:

```cmd
psql "postgresql://social_listening_user:password@dpg-xxxxx.oregon-postgres.render.com/social_listening"
```

---

## Render Backend Deployment

### 1. Create Web Service

1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select `SocialListening` repository

### 2. Configure Service

**Basic Settings:**
- Name: `social-listening-api`
- Region: Same as database
- Branch: `main`
- Root Directory: `backend`
- Runtime: `Python 3`

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Plan:** Free (for testing) or Starter (for production)

### 3. Add Environment Variables

Click "Environment" tab and add:

```env
PYTHON_VERSION=3.11.0
DATABASE_URL=<your-render-postgresql-internal-url>
FRONTEND_URL=https://your-app.vercel.app
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=<generate-a-very-long-random-string>
AI_PROVIDER=dummy
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
```

**Important:**
- Use **Internal Database URL** from Render PostgreSQL
- `FRONTEND_URL` will be your Vercel URL (update after Vercel deployment)
- Generate a strong `SECRET_KEY`: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

### 4. Deploy

Click "Create Web Service"

Render will:
1. Clone your repository
2. Install dependencies
3. Run migrations
4. Start the server

**Deployment URL:** `https://social-listening-api.onrender.com`

### 5. Verify Deployment

Visit:
- Health: `https://social-listening-api.onrender.com/health`
- Docs: `https://social-listening-api.onrender.com/docs`

---

## Vercel Frontend Deployment

### 1. Create Vercel Account

Go to https://vercel.com and sign up with GitHub.

### 2. Import Project

1. Click "Add New..." → "Project"
2. Import `SocialListening` repository
3. Vercel will auto-detect Next.js

### 3. Configure Project

**Framework Preset:** Next.js (auto-detected)

**Root Directory:** `frontend`

**Build Command:** `npm run build` (default)

**Output Directory:** `.next` (default)

**Install Command:** `npm install` (default)

### 4. Add Environment Variables

Click "Environment Variables" and add:

```env
NEXT_PUBLIC_API_URL=https://social-listening-api.onrender.com
```

Use your Render backend URL.

### 5. Deploy

Click "Deploy"

Vercel will:
1. Clone repository
2. Install dependencies
3. Build Next.js app
4. Deploy to CDN

**Deployment URL:** `https://your-app.vercel.app`

### 6. Update Backend CORS

Go back to Render backend:
1. Environment variables
2. Update `FRONTEND_URL=https://your-app.vercel.app`
3. Save (this will redeploy backend)

### 7. Verify Deployment

Visit: `https://your-app.vercel.app`

Login with:
- Email: `admin@example.com`
- Password: `admin123`

---

## Environment Variables

### Backend (.env)

**Local Development:**
```env
ENVIRONMENT=development
DEBUG=True
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:123456@localhost:5432/social_listening
SECRET_KEY=local-dev-secret-key
AI_PROVIDER=dummy
```

**Production (Render):**
```env
ENVIRONMENT=production
DEBUG=False
FRONTEND_URL=https://your-app.vercel.app
DATABASE_URL=<render-postgresql-internal-url>
SECRET_KEY=<strong-random-secret>
AI_PROVIDER=openai
OPENAI_API_KEY=<your-key>
```

### Frontend (.env.local)

**Local Development:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Production (Vercel):**
```env
NEXT_PUBLIC_API_URL=https://social-listening-api.onrender.com
```

---

## CORS Setup

CORS is configured in `backend/app/main.py` and `backend/app/core/config.py`.

**How it works:**
1. `FRONTEND_URL` environment variable is read
2. CORS middleware allows:
   - `http://localhost:3000` (local dev)
   - `http://127.0.0.1:3000` (local dev)
   - Value from `FRONTEND_URL` (production)

**To add more origins:**

Edit `backend/app/core/config.py`:

```python
@property
def cors_origins(self) -> List[str]:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://your-custom-domain.com",  # Add here
    ]
    if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
        origins.append(self.FRONTEND_URL)
    return origins
```

---

## Alembic Migration Commands

### Create New Migration

After changing models:

```cmd
cd backend
.\venv\Scripts\activate
alembic revision --autogenerate -m "description of changes"
```

### Apply Migrations

**Local:**
```cmd
alembic upgrade head
```

**Production (Render):**
Migrations run automatically on deployment via start command:
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Rollback Migration

```cmd
alembic downgrade -1
```

### View Migration History

```cmd
alembic history
```

### View Current Version

```cmd
alembic current
```

---

## Production Test Checklist

### Backend Tests

- [ ] Health check: `https://your-api.onrender.com/health`
- [ ] API docs: `https://your-api.onrender.com/docs`
- [ ] Database connection works
- [ ] Alembic migrations applied
- [ ] CORS allows frontend domain
- [ ] Environment variables configured
- [ ] Login endpoint works
- [ ] Protected routes require authentication

### Frontend Tests

- [ ] Home page loads: `https://your-app.vercel.app`
- [ ] API URL points to production backend
- [ ] Login page works
- [ ] Dashboard loads after login
- [ ] Keyword management page loads
- [ ] Source management page loads
- [ ] Mention list page loads
- [ ] Alert dashboard loads
- [ ] No console errors

### End-to-End Tests

- [ ] Create keyword group
- [ ] Add keywords to group
- [ ] Add source (RSS/website)
- [ ] Trigger manual scan
- [ ] View mentions (if any)
- [ ] View alerts (if any)
- [ ] Create incident from mention
- [ ] Generate report
- [ ] Generate takedown draft

### Performance Tests

- [ ] Page load time < 3s
- [ ] API response time < 1s
- [ ] No memory leaks
- [ ] Database queries optimized

---

## Common Errors and Fixes

### Local Development

**Error: "PostgreSQL is not running"**
```
Fix: Start PostgreSQL service
Win + R → services.msc → postgresql → Start
```

**Error: "Module not found"**
```
Fix: Install dependencies
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
```

**Error: "Port 8000 already in use"**
```
Fix: Kill process using port 8000
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

**Error: "CORS policy error"**
```
Fix: Check FRONTEND_URL in backend/.env
Should be: http://localhost:3000
```

**Error: "Database connection failed"**
```
Fix: Check DATABASE_URL in backend/.env
Verify PostgreSQL is running: pg_isready -U postgres
```

### Render Deployment

**Error: "Build failed"**
```
Fix: Check build logs in Render dashboard
Common issues:
- Missing requirements.txt
- Wrong Python version
- Syntax errors in code
```

**Error: "Database connection failed"**
```
Fix: Use Internal Database URL from Render PostgreSQL
Format: postgresql://user:pass@internal-host/dbname
```

**Error: "Migrations failed"**
```
Fix: Check Alembic configuration
Ensure alembic.ini has correct sqlalchemy.url
Or use DATABASE_URL environment variable
```

**Error: "Service won't start"**
```
Fix: Check start command
Should be: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Vercel Deployment

**Error: "Build failed"**
```
Fix: Check build logs in Vercel dashboard
Common issues:
- Missing dependencies in package.json
- TypeScript errors
- Environment variables not set
```

**Error: "API calls fail"**
```
Fix: Check NEXT_PUBLIC_API_URL
Should point to Render backend: https://your-api.onrender.com
```

**Error: "CORS error in production"**
```
Fix: Update FRONTEND_URL in Render backend
Should be: https://your-app.vercel.app
Redeploy backend after changing
```

### Database Issues

**Error: "Too many connections"**
```
Fix: Check connection pool settings
In config.py, reduce pool_size and max_overflow
```

**Error: "Migration conflict"**
```
Fix: Resolve migration conflicts
alembic history
alembic downgrade <revision>
Fix conflicts in migration files
alembic upgrade head
```

---

## Quick Reference

### Local Development Commands

**Start Everything:**
```cmd
REM Terminal 1 - Backend
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload

REM Terminal 2 - Frontend
cd frontend
npm run dev
```

**Or use batch file:**
```cmd
RUN.bat
```

### Production URLs

- Frontend: `https://your-app.vercel.app`
- Backend API: `https://social-listening-api.onrender.com`
- API Docs: `https://social-listening-api.onrender.com/docs`

### Default Credentials

- Email: `admin@example.com`
- Password: `admin123`

**⚠️ Change password after first login in production!**

---

## Support

For issues:
1. Check logs in Render/Vercel dashboard
2. Review this deployment guide
3. Check GitHub Issues
4. Contact support

---

**Last Updated:** May 9, 2026
**Version:** 1.0.0
