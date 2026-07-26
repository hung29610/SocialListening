#!/usr/bin/env python3
"""
Debug Auth Endpoint
Kiểm tra chi tiết lỗi của /api/auth/me endpoint
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
EMAIL = user_email()
PASSWORD = user_password()

def login():
    """Login and get token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": EMAIL, "password": PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    return None

def test_auth_me():
    """Test /api/auth/me endpoint"""
    print("=" * 80)
    print("DEBUG: /api/auth/me ENDPOINT")
    print("=" * 80)
    print()
    
    # Login
    print("🔐 Logging in...")
    token = login()
    if not token:
        print("❌ Login failed!")
        return
    print("✅ Login successful")
    print(f"Token: {token[:20]}...")
    print()
    
    # Test /api/auth/me
    print("🔍 Testing /api/auth/me...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print()
        
        if response.status_code == 200:
            print("✅ SUCCESS!")
            print()
            print("Response:")
            print(json.dumps(response.json(), indent=2))
        else:
            print("❌ FAILED!")
            print()
            print("Response:")
            print(response.text)
            
            # Try to get more details
            if response.headers.get('content-type') == 'application/json':
                try:
                    error_data = response.json()
                    print()
                    print("Error Details:")
                    print(json.dumps(error_data, indent=2))
                except:
                    pass
    
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_auth_me()
