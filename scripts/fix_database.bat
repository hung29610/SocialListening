@echo off
set DATABASE_URL=postgresql://<redacted>:<redacted-email>/social_listening_db_v2

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
