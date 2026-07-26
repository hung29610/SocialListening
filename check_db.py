"""
Developer utility: inspect a user row and optionally reset that user's password.

This script previously embedded a full PostgreSQL connection string (including
database credentials), a target account email and a replacement password. All
three now come from the environment, and the script refuses to run without them:

    NOPE360_DB_URL          PostgreSQL connection string (or DATABASE_URL)
    NOPE360_TARGET_EMAIL    account to inspect
    NOPE360_NEW_PASSWORD    replacement password (optional; omit to inspect only)

Nothing is printed except the row's id/email/is_active and a success flag; the
connection string and the password value are never echoed.

Usage (PowerShell):
    $env:NOPE360_DB_URL = "<connection string>"
    $env:NOPE360_TARGET_EMAIL = "someone@example.com"
    python check_db.py            # inspect only
"""
import os
import sys
from typing import Optional, Tuple

MIN_PASSWORD_LENGTH = 12


def _config() -> Tuple[str, str, Optional[str]]:
    db_url = (os.getenv("NOPE360_DB_URL") or os.getenv("DATABASE_URL") or "").strip()
    email = (os.getenv("NOPE360_TARGET_EMAIL") or "").strip()
    new_password = os.getenv("NOPE360_NEW_PASSWORD") or ""

    problems = []
    if not db_url:
        problems.append("NOPE360_DB_URL (or DATABASE_URL) is required.")
    if not email:
        problems.append("NOPE360_TARGET_EMAIL is required.")
    if new_password and len(new_password) < MIN_PASSWORD_LENGTH:
        problems.append(f"NOPE360_NEW_PASSWORD must be at least {MIN_PASSWORD_LENGTH} characters.")

    if problems:
        print("Cannot run check_db.py:")
        for problem in problems:
            print(f"  - {problem}")
        print("\nSet the variables listed in .env.example and run again.")
        print("Never hardcode a connection string or password back into this file.")
        sys.exit(1)

    return db_url, email, (new_password or None)


def main() -> int:
    db_url, email, new_password = _config()

    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email, is_active FROM users WHERE email = %s", (email,))
        rows = cur.fetchall()
        if not rows:
            print("No user found for the configured NOPE360_TARGET_EMAIL.")
            return 1

        user_id, user_email, is_active = rows[0]
        print(f"Found user: id={user_id} email={user_email} is_active={is_active}")

        if not new_password:
            print("NOPE360_NEW_PASSWORD not set - inspect-only run, nothing changed.")
            return 0

        import bcrypt

        hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute("UPDATE users SET hashed_password = %s WHERE id = %s", (hashed, user_id))
        conn.commit()
        print("Password updated for the configured user (value not shown).")
        return 0
    except Exception as exc:
        conn.rollback()
        # Print the error type only: a psycopg2 message can echo the DSN.
        print(f"Database operation failed: {type(exc).__name__}")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
