@echo off
if not defined DATABASE_URL (
    echo ERROR: DATABASE_URL is required
    exit /b 1
)

python create_alembic_version.py

pause
