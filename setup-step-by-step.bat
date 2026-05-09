@echo off
setlocal enabledelayedexpansion
set "ROOT_DIR=%~dp0"

cls
echo ========================================
echo SETUP - STEP BY STEP
echo ========================================
echo.

echo Step 1: Create .env files
cd /d "%ROOT_DIR%backend"
if not exist .env (
    copy .env.example .env >nul
    echo ✓ Created backend/.env
) else (
    echo ✓ backend/.env already exists
)

cd /d "%ROOT_DIR%frontend"
if not exist .env.local (
    copy .env.example .env.local >nul
    echo ✓ Created frontend/.env.local
) else (
    echo ✓ frontend/.env.local already exists
)

echo.
echo Step 2: Install Python packages (Virtual Environment)
cd /d "%ROOT_DIR%backend"
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)
echo Installing Python dependencies in virtual environment...
.\venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python packages
    echo Please check your Python installation
    pause
    exit /b 1
)
echo ✓ Python packages installed in virtual environment

echo.
echo Step 3: Install Node packages
cd /d "%ROOT_DIR%frontend"
echo Installing Node dependencies (this may take 5-10 minutes)...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install Node packages
    echo Please check your Node.js installation
    pause
    exit /b 1
)
echo ✓ Node packages installed

echo.
echo Step 4: Install Playwright browsers
cd /d "%ROOT_DIR%backend"
echo Installing Playwright browsers...
playwright install chromium
echo ✓ Playwright browsers installed

echo.
echo Step 5: Initialize database
echo.
echo IMPORTANT: Make sure PostgreSQL is running!
echo Press any key when PostgreSQL is ready...
pause >nul

REM Check if PostgreSQL is running
pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL is not running!
    echo Please start PostgreSQL and try again
    pause
    exit /b 1
)

echo Creating database...
psql -U postgres -c "CREATE DATABASE IF NOT EXISTS social_listening;" 2>nul
echo Running migrations...
.\venv\Scripts\alembic upgrade head
if errorlevel 1 (
    echo ERROR: Database migration failed
    echo Please check PostgreSQL connection
    pause
    exit /b 1
)
echo ✓ Database initialized

echo.
echo Step 6: Create admin user
.\venv\Scripts\python.exe -m app.scripts.create_admin
echo ✓ Admin user created

cd /d "%ROOT_DIR%"
echo.
echo ========================================
echo ✓ SETUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure PostgreSQL is running
echo 2. Run: RUN.bat
echo 3. Access: http://localhost:8000
echo.
pause
