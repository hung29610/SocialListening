"""
Create new admin user
Email: honguyenhung2010@gmail.com
Password: configured via ADMIN_PASSWORD
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.core.security import get_password_hash

# Database URL
DATABASE_URL = os.environ["DATABASE_URL"]

def create_admin():
    """Create new admin user"""
    print("=" * 80)
    print("CREATING NEW ADMIN USER")
    print("=" * 80)
    
    # Connect to database
    print("\nðŸ”Œ Connecting to database...")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Admin details
        email = os.environ["ADMIN_EMAIL"]
        password = os.environ["ADMIN_PASSWORD"]
        full_name = "Ho Nguyen Hung"
        
        print(f"\nðŸ‘¤ Creating admin user:")
        print(f"   Email: {email}")
        print(f"   Full Name: {full_name}")
        print(f"   Is Superuser: True")
        
        # Check if user already exists
        stmt = select(User).where(User.email == email)
        existing_user = db.execute(stmt).scalar_one_or_none()
        
        if existing_user:
            print(f"\nâš ï¸  User with email {email} already exists!")
            print(f"   User ID: {existing_user.id}")
            print(f"   Is Superuser: {existing_user.is_superuser}")
            
            # Update to superuser if not already
            if not existing_user.is_superuser:
                print(f"\nðŸ”„ Updating to superuser...")
                existing_user.is_superuser = True
                existing_user.is_active = True
                db.commit()
                print(f"âœ… Updated user to superuser!")
            else:
                print(f"âœ… User is already a superuser!")
            
            # Update password
            print(f"\nðŸ”‘ Updating password...")
            existing_user.hashed_password = get_password_hash(password)
            db.commit()
            print(f"âœ… Password updated!")
            
            return existing_user
        
        # Create new user
        print(f"\nâž• Creating new user...")
        hashed_password = get_password_hash(password)
        
        new_user = User(
            email=os.environ["ADMIN_EMAIL"],
            hashed_password=hashed_password,
            full_name=full_name,
            is_superuser=True,
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"\nâœ… Admin user created successfully!")
        print(f"   User ID: {new_user.id}")
        print(f"   Email: {new_user.email}")
        print(f"   Full Name: {new_user.full_name}")
        print(f"   Is Superuser: {new_user.is_superuser}")
        print(f"   Active: {new_user.is_active}")
        
        return new_user
        
    except Exception as e:
        print(f"\nâŒ ERROR: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

def verify_admin():
    """Verify admin user can login"""
    print("\n" + "=" * 80)
    print("VERIFYING ADMIN LOGIN")
    print("=" * 80)
    
    import requests
    
    BASE_URL = os.environ["BACKEND_URL"]
    email = os.environ["ADMIN_EMAIL"]
    password = os.environ["ADMIN_PASSWORD"]
    
    print(f"\nðŸ” Testing login...")
    print(f"   Email: {email}")
    print(f"   URL: {BASE_URL}/api/auth/login")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"\nâœ… Login successful!")
            print(f"   Token: {token[:50]}...")
            
            # Get user info
            print(f"\nðŸ‘¤ Getting user info...")
            user_response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if user_response.status_code == 200:
                user_data = user_response.json()
                print(f"âœ… User info retrieved!")
                print(f"   ID: {user_data.get('id')}")
                print(f"   Email: {user_data.get('email')}")
                print(f"   Full Name: {user_data.get('full_name')}")
                print(f"   Is Superuser: {user_data.get('is_superuser')}")
                print(f"   Active: {user_data.get('is_active')}")
            else:
                print(f"âŒ Failed to get user info: {user_response.status_code}")
                print(f"   {user_response.text}")
        else:
            print(f"âŒ Login failed: {response.status_code}")
            print(f"   {response.text}")
            
    except Exception as e:
        print(f"âŒ ERROR: {str(e)}")

def main():
    print("\nðŸš€ Starting admin creation process...\n")
    
    # Create admin
    user = create_admin()
    
    # Verify login
    print("\nâ³ Waiting 2 seconds before testing login...")
    import time
    time.sleep(2)
    
    verify_admin()
    
    print("\n" + "=" * 80)
    print("âœ… ADMIN CREATION COMPLETED!")
    print("=" * 80)
    print(f"\nðŸ“ Login credentials:")
    print(f"   Email: honguyenhung2010@gmail.com")
    print("   Password: configured via ADMIN_PASSWORD")
    print(f"   Is Superuser: True (Full Admin Access)")
    print(f"\nðŸŒ Login URL:")
    print(f"   https://social-listening-azure.vercel.app/login")
    print("\n")

if __name__ == "__main__":
    main()
