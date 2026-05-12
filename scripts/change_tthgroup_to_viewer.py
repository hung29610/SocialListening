"""
Change tthgroup@gmail.com role from super_admin to viewer
"""
import requests

BACKEND_URL = "https://social-listening-backend.onrender.com"
ADMIN_EMAIL = "honguyenhung2010@gmail.com"
ADMIN_PASSWORD = "Hungnguyen@1515"

print("=" * 60)
print("CHANGE TTHGROUP ROLE TO VIEWER")
print("=" * 60)

# Login as admin
print("\n1. Logging in as admin...")
login_response = requests.post(
    f"{BACKEND_URL}/api/auth/login",
    data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

if login_response.status_code != 200:
    print("❌ Login failed")
    exit(1)

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("✅ Logged in")

# Get tthgroup user
print("\n2. Finding tthgroup user...")
users_response = requests.get(f"{BACKEND_URL}/api/admin/users", headers=headers)

if users_response.status_code != 200:
    print("❌ Failed to get users")
    exit(1)

users = users_response.json()
tthgroup_user = None

for user in users:
    if 'tthgroup' in user['email'].lower():
        tthgroup_user = user
        break

if not tthgroup_user:
    print("❌ tthgroup user not found")
    exit(1)

print(f"✅ Found user: {tthgroup_user['email']}")
print(f"   Current role: {tthgroup_user.get('role', 'N/A')}")
print(f"   User ID: {tthgroup_user['id']}")

# Update role to viewer
print("\n3. Updating role to 'viewer'...")

# We need to use SQL directly since there's no API endpoint to update role
# Let's use the admin endpoint to run SQL
print("\n⚠️  Note: There's no API endpoint to update user role directly.")
print("   You need to run this SQL in database:")
print(f"\n   UPDATE users SET role = 'viewer' WHERE id = {tthgroup_user['id']};")
print("\nOr logout and login with normal user account:")
print("   Email: admin@sociallistening.com")
print("   Password: Admin@123456")

print("\n" + "=" * 60)
