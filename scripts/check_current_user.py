"""
Check current user data from /api/auth/me
"""
import requests
import json

BASE_URL = "https://social-listening-backend.onrender.com"

# Test with admin account
print("="*60)
print("  ADMIN ACCOUNT TEST")
print("="*60)

response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": "honguyenhung2010@gmail.com", "password": "Hungnguyen@1515"}
)

if response.status_code == 200:
    token = response.json()["access_token"]
    
    # Get current user
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print("\nGET /api/auth/me:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
else:
    print(f"Login failed: {response.text}")

# Test with normal account if exists
print("\n" + "="*60)
print("  NORMAL ACCOUNT TEST (if exists)")
print("="*60)

response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": "admin@sociallistening.com", "password": "Admin@123456"}
)

if response.status_code == 200:
    token = response.json()["access_token"]
    
    # Get current user
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print("\nGET /api/auth/me:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
else:
    print(f"Login failed or account doesn't exist")
