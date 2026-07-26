@echo off
set DATABASE_URL=postgresql://<redacted>:<redacted-email>/social_listening_db_v2

python create_alembic_version.py

pause
