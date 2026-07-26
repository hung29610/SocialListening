"""
Check current user data from /api/auth/me
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _env_config import (  # noqa: E402
    account_email,
    account_password,
    admin_email,
    admin_password,
    alt_email,
    alt_password,
    backend_url,
    user_email,
    user_password,
)

import requests
import json

BASE_URL = backend_url()

# Test with admin account
print("="*60)
print("  ADMIN ACCOUNT TEST")
print("="*60)

response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": admin_email(), "password": admin_password()}
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
    data={"username": user_email(), "password": user_password()}
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
