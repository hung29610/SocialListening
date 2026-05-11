"""
Create new admin user
Email: honguyenhung2010@gmail.com
Password: Hungnguyen@1515
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
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://social_listening_db_v2_user:6F6oJaZmFDi5xIDGd4lvALUkQIpsxVkQ@dpg-d7vfpv3rjlhs73dnrgf0-a.oregon-postgres.render.com/social_listening_db_v2"
)

def create_admin():
    """Create new admin user"""
    print("=" * 80)
    print("CREATING NEW ADMIN USER")
    print("=" * 80)
    
    # Connect to database
    print("\n🔌 Connecting to database...")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Admin details
        email = "honguyenhung2010@gmail.com"
        password = "Hungnguyen@1515"
        full_name = "Ho Nguyen Hung"
        
        print(f"\n👤 Creating admin user:")
        print(f"   Email: {email}")
        print(f"   Full Name: {full_name}")
        print(f"   Is Superuser: True")
        
        # Check if user already exists
        stmt = select(User).where(User.email == email)
        existing_user = db.execute(stmt).scalar_one_or_none()
        
        if existing_user:
            print(f"\n⚠️  User with email {email} already exists!")
            print(f"   User ID: {existing_user.id}")
            print(f"   Is Superuser: {existing_user.is_superuser}")
            
            # Update to superuser if not already
            if not existing_user.is_superuser:
                print(f"\n🔄 Updating to superuser...")
                existing_user.is_superuser = True
                existing_user.is_active = True
                db.commit()
                print(f"✅ Updated user to superuser!")
            else:
                print(f"✅ User is already a superuser!")
            
            # Update password
            print(f"\n🔑 Updating password...")
            existing_user.hashed_password = get_password_hash(password)
            db.commit()
            print(f"✅ Password updated!")
            
            return existing_user
        
        # Create new user
        print(f"\n➕ Creating new user...")
        hashed_password = get_password_hash(password)
        
        new_user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            is_superuser=True,
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"\n✅ Admin user created successfully!")
        print(f"   User ID: {new_user.id}")
        print(f"   Email: {new_user.email}")
        print(f"   Full Name: {new_user.full_name}")
        print(f"   Is Superuser: {new_user.is_superuser}")
        print(f"   Active: {new_user.is_active}")
        
        return new_user
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
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
    
    BASE_URL = "https://social-listening-backend.onrender.com"
    email = "honguyenhung2010@gmail.com"
    password = "Hungnguyen@1515"
    
    print(f"\n🔐 Testing login...")
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
            print(f"\n✅ Login successful!")
            print(f"   Token: {token[:50]}...")
            
            # Get user info
            print(f"\n👤 Getting user info...")
            user_response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if user_response.status_code == 200:
                user_data = user_response.json()
                print(f"✅ User info retrieved!")
                print(f"   ID: {user_data.get('id')}")
                print(f"   Email: {user_data.get('email')}")
                print(f"   Full Name: {user_data.get('full_name')}")
                print(f"   Is Superuser: {user_data.get('is_superuser')}")
                print(f"   Active: {user_data.get('is_active')}")
            else:
                print(f"❌ Failed to get user info: {user_response.status_code}")
                print(f"   {user_response.text}")
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

def main():
    print("\n🚀 Starting admin creation process...\n")
    
    # Create admin
    user = create_admin()
    
    # Verify login
    print("\n⏳ Waiting 2 seconds before testing login...")
    import time
    time.sleep(2)
    
    verify_admin()
    
    print("\n" + "=" * 80)
    print("✅ ADMIN CREATION COMPLETED!")
    print("=" * 80)
    print(f"\n📝 Login credentials:")
    print(f"   Email: honguyenhung2010@gmail.com")
    print(f"   Password: Hungnguyen@1515")
    print(f"   Is Superuser: True (Full Admin Access)")
    print(f"\n🌐 Login URL:")
    print(f"   https://social-listening-azure.vercel.app/login")
    print("\n")

if __name__ == "__main__":
    main()
