@echo off
set DATABASE_URL=postgresql://social_listening_db_v2_user:6F6oJaZmFDi5xIDGd4lvALUkQIpsxVkQ@dpg-d7vfpv3rjlhs73dnrgf0-a.oregon-postgres.render.com/social_listening_db_v2

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
