"""
Run role migration to add role column to users table
"""
import requests
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Get backend URL
BACKEND_URL = os.getenv("BACKEND_URL", "https://social-listening-backend.onrender.com")

# Admin credentials
ADMIN_EMAIL = "honguyenhung2010@gmail.com"
ADMIN_PASSWORD = "Hungnguyen@1515"

def main():
    print("=" * 60)
    print("RUNNING ROLE MIGRATION")
    print("=" * 60)
    
    # Login as admin
    print("\n1. Logging in as admin...")
    login_response = requests.post(
        f"{BACKEND_URL}/api/auth/login",
        data={
            "username": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(login_response.text)
        return
    
    token = login_response.json()["access_token"]
    print(f"✅ Login successful")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Run migration
    print("\n2. Running role migration...")
    migration_response = requests.post(
        f"{BACKEND_URL}/api/admin/add-user-role-column",
        headers=headers
    )
    
    if migration_response.status_code == 200:
        result = migration_response.json()
        print(f"✅ Migration result: {result['message']}")
        print(f"   Status: {result['status']}")
        if 'details' in result:
            print(f"   Details: {result['details']}")
    else:
        print(f"❌ Migration failed: {migration_response.status_code}")
        print(migration_response.text)
        return
    
    # Verify by checking current user
    print("\n3. Verifying current user role...")
    me_response = requests.get(
        f"{BACKEND_URL}/api/auth/me",
        headers=headers
    )
    
    if me_response.status_code == 200:
        user = me_response.json()
        print(f"✅ Current user:")
        print(f"   Email: {user['email']}")
        print(f"   Is Superuser: {user['is_superuser']}")
        if 'role' in user:
            print(f"   Role: {user['role']}")
        else:
            print(f"   ⚠️  Role field not in response yet (need to update model)")
    else:
        print(f"❌ Failed to get current user: {me_response.status_code}")
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    main()
