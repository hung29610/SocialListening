#!/usr/bin/env python3
"""
Test Services API directly
"""

import requests
import json

BASE_URL = "https://social-listening-backend.onrender.com"
EMAIL = "admin@sociallistening.com"
PASSWORD = "Admin@123456"

def login():
    """Login and get access token"""
    login_data = {
        "username": EMAIL,
        "password": PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
    if response.status_code == 200:
        token_data = response.json()
        return token_data["access_token"]
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

def test_list_services(token):
    """Test list services"""
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{BASE_URL}/api/services", headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")  # First 500 chars
    
    if response.status_code == 200:
        services = response.json()
        print(f"\nFound {len(services)} services")
        if services:
            print(f"\nFirst service:")
            print(json.dumps(services[0], indent=2, default=str))
    
def test_dashboard_summary(token):
    """Test dashboard summary"""
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{BASE_URL}/api/services/dashboard-summary", headers=headers)
    print(f"\n=== Dashboard Summary ===")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        summary = response.json()
        print(json.dumps(summary, indent=2, default=str))

def main():
    print("Testing Services API...")
    token = login()
    if not token:
        return
    
    print("\n=== List Services ===")
    test_list_services(token)
    
    test_dashboard_summary(token)

if __name__ == "__main__":
    main()