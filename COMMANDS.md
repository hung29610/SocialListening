# Quick Command Reference

Essential commands for Social Listening Platform development and deployment.

## Local Development

### PostgreSQL Commands

**Start PostgreSQL (Windows Service):**
```cmd
net start postgresql-x64-16
```

**Check PostgreSQL Status:**
```cmd
pg_isready -U postgres
```

**Create Database:**
```cmd
createdb -U postgres social_listening
```

**Connect to Database:**
```cmd
psql -U postgres -d social_listening
```

**Drop Database (if needed):**
```cmd
dropdb -U postgres social_listening
```

### Backend Commands

**Navigate to Backend:**
```cmd
cd backend
```

**Create Virtual Environment:**
```cmd
python -m venv venv
```

**Activate Virtual Environment:**
```cmd
.\venv\Scripts\activate
```

**Install Dependencies:**
```cmd
pip install -r requirements.txt
```

**Run Migrations:**
```cmd
alembic upgrade head
```

**Create Migration:**
```cmd
alembic revision --autogenerate -m "description"
```

**Rollback Migration:**
```cmd
alembic downgrade -1
```

**Create Admin User:**
```cmd
python -m app.scripts.create_admin
```

**Start Backend Server:**
```cmd
uvicorn app.main:app --reload
```

**Start Backend (Production Mode):**
```cmd
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Commands

**Navigate to Frontend:**
```cmd
cd frontend
```

**Install Dependencies:**
```cmd
npm install
```

**Start Development Server:**
```cmd
npm run dev
```

**Build for Production:**
```cmd
npm run build
```

**Start Production Server:**
```cmd
npm start
```

**Run Linter:**
```cmd
npm run lint
```

### Quick Start (Using Batch Files)

**First Time Setup:**
```cmd
setup-step-by-step.bat
```

**Run Application:**
```cmd
RUN.bat
```

**Create Admin User:**
```cmd
create-admin.bat
```

**Start PostgreSQL:**
```cmd
start-postgres-simple.bat
```

## Git Commands

**Initialize Repository:**
```cmd
git init
```

**Add All Files:**
```cmd
git add .
```

**Commit Changes:**
```cmd
git commit -m "commit message"
```

**Add Remote:**
```cmd
git remote add origin https://github.com/username/repo.git
```

**Push to GitHub:**
```cmd
git push -u origin main
```

**Pull Latest Changes:**
```cmd
git pull origin main
```

**Check Status:**
```cmd
git status
```

**View Commit History:**
```cmd
git log --oneline
```

## Database Management

### Alembic Commands

**Check Current Version:**
```cmd
alembic current
```

**View Migration History:**
```cmd
alembic history
```

**Upgrade to Specific Version:**
```cmd
alembic upgrade <revision>
```

**Downgrade to Specific Version:**
```cmd
alembic downgrade <revision>
```

**Show SQL for Migration:**
```cmd
alembic upgrade head --sql
```

### PostgreSQL Commands

**List Databases:**
```sql
\l
```

**Connect to Database:**
```sql
\c social_listening
```

**List Tables:**
```sql
\dt
```

**Describe Table:**
```sql
\d table_name
```

**Show Table Data:**
```sql
SELECT * FROM users LIMIT 10;
```

**Count Records:**
```sql
SELECT COUNT(*) FROM mentions;
```

**Exit psql:**
```sql
\q
```

## Testing Commands

### Backend Testing

**Run All Tests:**
```cmd
pytest
```

**Run Specific Test:**
```cmd
pytest tests/test_auth.py
```

**Run with Coverage:**
```cmd
pytest --cov=app tests/
```

### Frontend Testing

**Run Tests:**
```cmd
npm test
```

**Run Tests in Watch Mode:**
```cmd
npm test -- --watch
```

## Deployment Commands

### Render Backend

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Vercel Frontend

**Build Command:**
```bash
npm run build
```

**Install Command:**
```bash
npm install
```

## Troubleshooting Commands

### Check Ports

**Check if Port is in Use:**
```cmd
netstat -ano | findstr :8000
netstat -ano | findstr :3000
```

**Kill Process by PID:**
```cmd
taskkill /PID <pid> /F
```

### Check Services

**List Running Services:**
```cmd
sc query | findstr postgresql
```

**Start Service:**
```cmd
sc start postgresql-x64-16
```

**Stop Service:**
```cmd
sc stop postgresql-x64-16
```

### Check Python/Node Versions

**Python Version:**
```cmd
python --version
```

**Node Version:**
```cmd
node --version
```

**npm Version:**
```cmd
npm --version
```

### Check Installed Packages

**Python Packages:**
```cmd
pip list
```

**Node Packages:**
```cmd
npm list --depth=0
```

## Environment Variables

### Generate SECRET_KEY

**Python:**
```python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### View Environment Variables

**Windows CMD:**
```cmd
set
```

**PowerShell:**
```powershell
Get-ChildItem Env:
```

## Useful Shortcuts

### Windows

- `Win + R` → Open Run dialog
- `Win + X` → Power User menu
- `Ctrl + C` → Stop running process
- `Ctrl + Shift + Esc` → Task Manager

### Terminal

- `Ctrl + C` → Stop current command
- `Ctrl + L` → Clear screen
- `Tab` → Auto-complete
- `↑` / `↓` → Command history

## API Testing

### Using curl

**Health Check:**
```bash
curl http://localhost:8000/health
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=admin123"
```

**Get Current User:**
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Using PowerShell

**Health Check:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

**Login:**
```powershell
$body = @{
    username = "admin@example.com"
    password = "admin123"
}
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -Body $body
```

## Logs

### View Backend Logs

**Development:**
```cmd
# Logs appear in terminal where uvicorn is running
```

**Production (Render):**
```
# View in Render dashboard → Logs tab
```

### View Frontend Logs

**Development:**
```cmd
# Logs appear in terminal where npm run dev is running
```

**Production (Vercel):**
```
# View in Vercel dashboard → Deployments → Logs
```

## Backup & Restore

### Database Backup

**Backup Database:**
```cmd
pg_dump -U postgres social_listening > backup.sql
```

**Backup with Compression:**
```cmd
pg_dump -U postgres -Fc social_listening > backup.dump
```

### Database Restore

**Restore from SQL:**
```cmd
psql -U postgres social_listening < backup.sql
```

**Restore from Dump:**
```cmd
pg_restore -U postgres -d social_listening backup.dump
```

## Performance

### Database Performance

**Analyze Query:**
```sql
EXPLAIN ANALYZE SELECT * FROM mentions WHERE sentiment = 'negative';
```

**Show Slow Queries:**
```sql
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

**Vacuum Database:**
```sql
VACUUM ANALYZE;
```

### Check Resource Usage

**Windows Task Manager:**
```cmd
taskmgr
```

**Resource Monitor:**
```cmd
resmon
```

## Quick Reference URLs

### Local Development
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:3000

### Production (Update with your URLs)
- Frontend: https://your-app.vercel.app
- Backend API: https://your-api.onrender.com
- API Docs: https://your-api.onrender.com/docs

---

**Last Updated:** May 9, 2026  
**Version:** 1.0.0
