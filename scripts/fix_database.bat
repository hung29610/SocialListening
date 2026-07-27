@echo off
if not defined DATABASE_URL (
    echo ERROR: DATABASE_URL is required
    exit /b 1
)

echo ================================================================================
echo FIX DATABASE - Running script...
echo ================================================================================
echo.

python fix_database_direct.py

echo.
echo ================================================================================
echo Done! Press any key to exit...
echo ================================================================================
pause
