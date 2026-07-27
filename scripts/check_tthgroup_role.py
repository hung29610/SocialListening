"""
Check role of tthgroup@gmail.com account
"""
import os
import requests

BACKEND_URL = os.environ["BACKEND_URL"]

# Try to login with tthgroup account
print("=" * 60)
print("CHECKING TTHGROUP ACCOUNT")
print("=" * 60)

# We don't have the password, so let's check all users
print("\nAttempting to login as admin to check all users...")

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

login_response = requests.post(
    f"{BACKEND_URL}/api/auth/login",
    data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

if login_response.status_code != 200:
    print("❌ Failed to login as admin")
    exit(1)

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("✅ Logged in as admin")
print("\nFetching all users...")

users_response = requests.get(f"{BACKEND_URL}/api/admin/users", headers=headers)

if users_response.status_code == 200:
    users = users_response.json()
    print(f"\n✅ Found {len(users)} users:\n")
    
    for user in users:
        email = os.environ["ADMIN_EMAIL"]
        role = user.get('role', 'N/A')
        is_superuser = user.get('is_superuser', False)
        is_active = user.get('is_active', False)
        
        status = "🟢" if is_active else "🔴"
        admin_badge = "👑" if is_superuser else "  "
        
        print(f"{status} {admin_badge} {email}")
        print(f"   Role: {role}")
        print(f"   Superuser: {is_superuser}")
        print()
        
        if 'tthgroup' in email.lower():
            print("   ⚠️  THIS IS THE ACCOUNT YOU'RE TESTING WITH!")
            if role in ['admin', 'super_admin'] or is_superuser:
                print("   ✅ This account IS ADMIN - should see Settings menu")
            else:
                print("   🔒 This account is NOT ADMIN - should NOT see Settings menu")
            print()
else:
    print(f"❌ Failed to get users: {users_response.status_code}")

print("=" * 60)
