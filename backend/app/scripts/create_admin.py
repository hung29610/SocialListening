"""
Script to create an admin user.

The password is read from the environment and never hardcoded. A checked-in
default gets reused across deployments and eventually shows up in public breach
corpora, which is exactly what makes Chrome's Password Manager warn "the password
you just used was found in a data breach" after login.

Usage (PowerShell):
    $env:ADMIN_EMAIL = "admin@your-domain.com"
    $env:ADMIN_PASSWORD = "<a strong, unique password>"
    python -m app.scripts.create_admin

Usage (bash):
    ADMIN_EMAIL=admin@your-domain.com ADMIN_PASSWORD='<strong password>' \
        python -m app.scripts.create_admin

The password value is never printed or logged.
"""
import os
import sys

MIN_PASSWORD_LENGTH = 12


def _read_credentials() -> tuple[str, str]:
    """Read admin credentials from the environment, refusing weak input."""
    email = (os.getenv("ADMIN_EMAIL") or "").strip()
    password = os.getenv("ADMIN_PASSWORD") or ""

    problems = []
    if not email:
        problems.append("ADMIN_EMAIL is required.")
    elif "@" not in email:
        problems.append("ADMIN_EMAIL must be a valid email address.")

    if not password:
        problems.append("ADMIN_PASSWORD is required.")
    elif len(password) < MIN_PASSWORD_LENGTH:
        problems.append(f"ADMIN_PASSWORD must be at least {MIN_PASSWORD_LENGTH} characters.")

    if problems:
        print("Cannot create the admin user:")
        for problem in problems:
            print(f"  - {problem}")
        print("\nSet both variables and re-run. Do not reuse a password from another service.")
        sys.exit(1)

    return email, password


def create_admin() -> None:
    """Create the admin user if it does not exist."""
    # Credentials are validated before touching the database so a misconfigured
    # run fails fast without opening a connection.
    email, password = _read_credentials()

    # Imported lazily: validation above must not require a database at all.
    from sqlalchemy import select

    from app.core.database import Base, SessionLocal, engine
    from app.core.security import get_password_hash
    from app.models.user import User

    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        existing_admin = session.execute(select(User).where(User.email == email)).scalar_one_or_none()

        if existing_admin:
            print("Admin user already exists")
            print(f"   Email: {existing_admin.email}")
            return

        admin = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=os.getenv("ADMIN_FULL_NAME", "System Administrator"),
            is_active=True,
            is_superuser=True,
        )

        session.add(admin)
        session.commit()
        session.refresh(admin)

        print("Admin user created successfully")
        print(f"   Email: {admin.email}")
        print(f"   ID: {admin.id}")
        print("   Password: (taken from ADMIN_PASSWORD, not shown)")
    finally:
        session.close()


if __name__ == "__main__":
    create_admin()
