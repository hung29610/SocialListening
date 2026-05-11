"""
Run schedule migration via API endpoint
"""
import requests
import json

BASE_URL = "https://social-listening-backend.onrender.com"
ADMIN_EMAIL = "honguyenhung2010@gmail.com"
ADMIN_PASSWORD = "Hungnguyen@1515"

print("="*60)
print("  🔧 RUN SCHEDULE MIGRATION")
print("="*60)

# Login
print("\n1. Logging in as superuser...")
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

if response.status_code != 200:
    print(f"❌ Login failed: {response.text}")
    exit(1)

token = response.json()["access_token"]
print("✅ Login successful\n")

# Run migration
print("2. Running schedule migration...")
response = requests.post(
    f"{BASE_URL}/api/admin/run-schedule-migration",
    headers={"Authorization": f"Bearer {token}"}
)

print(f"Status Code: {response.status_code}")
print(f"\nResponse:")
print(json.dumps(response.json(), indent=2, ensure_ascii=False))

if response.status_code == 200:
    result = response.json()
    if result.get("success"):
        print("\n✅ MIGRATION SUCCESSFUL!")
        if result.get("status") == "skipped":
            print("   Columns already exist - safe to proceed")
        else:
            print(f"   Columns added: {', '.join(result.get('columns_added', []))}")
    else:
        print("\n❌ MIGRATION FAILED!")
else:
    print("\n❌ API ERROR!")

print("\n" + "="*60)
