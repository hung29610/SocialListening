@echo off
echo ========================================
echo   CREATE ADMIN USER
echo ========================================
echo.

cd /d "%~dp0backend"

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please run setup-step-by-step.bat first
    pause
    exit /b 1
)

REM Check if PostgreSQL is running
pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL is not running!
    echo Please start PostgreSQL first
    pause
    exit /b 1
)

echo Creating admin user...
.\venv\Scripts\python.exe -m app.scripts.create_admin
if errorlevel 1 (
    echo ERROR: Failed to create admin user
    echo Please check the error messages above
    pause
    exit /b 1
)

echo.
echo ✓ Admin user created successfully!
echo.
pause
