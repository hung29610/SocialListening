#!/usr/bin/env python3
"""Check backend health"""
import requests

BASE_URL = "https://social-listening-backend.onrender.com"
EMAIL = "admin@sociallistening.com"
PASSWORD = "Admin@123456"

# Login
login_data = {"username": EMAIL, "password": PASSWORD}
response = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
token = response.json()["access_token"]

headers = {"Authorization": f"Bearer {token}"}

print("🔍 Checking Backend Health")
print("=" * 60)

# Test various endpoints
endpoints = [
    ("Dashboard", "/api/dashboard"),
    ("Services List", "/api/services"),
    ("Service Categories", "/api/services/categories"),
    ("Service Requests", "/api/services/requests"),
    ("Dashboard Summary", "/api/services/dashboard-summary"),
    ("Service Catalog Status", "/api/admin/service-catalog-status"),
]

for name, endpoint in endpoints:
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        status = "✅" if response.status_code == 200 else "❌"
        print(f"{status} {name:30} Status: {response.status_code}")
        if response.status_code not in [200, 201]:
            print(f"   Response: {response.text[:100]}")
    except Exception as e:
        print(f"❌ {name:30} Error: {e}")

print("\n" + "=" * 60)
