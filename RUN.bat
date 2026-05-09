@echo off
setlocal enabledelayedexpansion
set "ROOT_DIR=%~dp0"

cls
echo ========================================
echo   SOCIAL LISTENING PLATFORM
echo ========================================
echo.

REM Check if setup done
if not exist "%ROOT_DIR%backend\.env" (
    echo ERROR: Setup not completed!
    echo.
    echo Please run: setup-step-by-step.bat first
    echo.
    pause
    exit /b 1
)

REM Check PostgreSQL (REQUIRED)
echo Checking PostgreSQL...
pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo.
    echo ========================================
    echo   POSTGRESQL NOT RUNNING
    echo ========================================
    echo.
    echo PostgreSQL is REQUIRED but not running!
    echo.
    echo Please start PostgreSQL manually:
    echo.
    echo Option 1: Using Services
    echo   1. Press Win + R
    echo   2. Type: services.msc
    echo   3. Find "postgresql" service
    echo   4. Right click and Start
    echo.
    echo Option 2: Using pgAdmin
    echo   - Open pgAdmin
    echo   - Right click server and Connect
    echo.
    echo Option 3: Install PostgreSQL
    echo   Download from: https://www.postgresql.org/download/windows/
    echo.
    echo After starting PostgreSQL, run this script again.
    echo.
    pause
    exit /b 1
)
echo PostgreSQL: OK
echo.

REM Check if services already running
tasklist /FI "WindowTitle eq Backend API*" 2>nul | find /I "cmd.exe" >nul
if not errorlevel 1 (
    echo Services are already running!
    echo.
    echo Backend API: http://localhost:8000
    echo Frontend:    http://localhost:3000
    echo.
    echo Close this window to stop all services...
    pause
    goto STOP_ALL
)

REM Start all services
echo Starting services...
echo.

echo [1/2] Backend API...
start "Backend API" cmd /k "cd /d "%ROOT_DIR%backend" && .\venv\Scripts\activate && set DATABASE_URL=postgresql://postgres:123456@localhost:5432/social_listening && echo Starting Backend API... && echo Backend: http://localhost:8000 && echo API Docs: http://localhost:8000/docs && echo. && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 5 >nul

echo [2/2] Frontend...
start "Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && echo Starting Frontend... && echo Frontend: http://localhost:3000 && echo. && npm run dev"
timeout /t 2 >nul

echo.
echo ========================================
echo ALL SERVICES STARTED!
echo ========================================
echo.
echo Backend API: http://localhost:8000
echo API Docs:    http://localhost:8000/docs
echo Frontend:    http://localhost:3000
echo.
echo NOTE: 
echo - If Backend shows errors, check PostgreSQL is running
echo - Close this window to stop all services
echo.
pause

:STOP_ALL
echo.
echo Stopping all services...
taskkill /FI "WindowTitle eq Backend API*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq Frontend*" /T /F >nul 2>&1
echo All services stopped.
timeout /t 2 >nul
exit
