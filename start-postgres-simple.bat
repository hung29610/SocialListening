@echo off
echo ========================================
echo   START POSTGRESQL SERVICE
echo ========================================
echo.

REM Try common PostgreSQL service names
echo Trying to start PostgreSQL service...
echo.

net start postgresql-x64-16 2>nul
if not errorlevel 1 (
    echo Success! PostgreSQL service started.
    timeout /t 2 >nul
    exit /b 0
)

net start postgresql-x64-15 2>nul
if not errorlevel 1 (
    echo Success! PostgreSQL service started.
    timeout /t 2 >nul
    exit /b 0
)

net start postgresql-x64-14 2>nul
if not errorlevel 1 (
    echo Success! PostgreSQL service started.
    timeout /t 2 >nul
    exit /b 0
)

net start postgresql 2>nul
if not errorlevel 1 (
    echo Success! PostgreSQL service started.
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo Could not start PostgreSQL service automatically.
echo.
echo Please start it manually:
echo 1. Press Win + R
echo 2. Type: services.msc
echo 3. Find "postgresql" service
echo 4. Right click and click Start
echo.
pause
exit /b 1
