#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://social-listening-backend.onrender.com"
EMAIL = "admin@sociallistening.com"
PASSWORD = "Admin@123456"

# Login
login_data = {"username": EMAIL, "password": PASSWORD}
response = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
token = response.json()["access_token"]

headers = {"Authorization": f"Bearer {token}"}

# Get categories
response = requests.get(f"{BASE_URL}/api/services/categories", headers=headers)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    categories = response.json()
    print(f"\nFound {len(categories)} categories:")
    for cat in categories:
        print(f"  - {cat['name']} (ID: {cat['id']})")
else:
    print(f"Error: {response.text}")

# Get services
response = requests.get(f"{BASE_URL}/api/services", headers=headers)
print(f"\nServices Status: {response.status_code}")

if response.status_code == 200:
    services = response.json()
    print(f"Found {len(services)} services:")
    for svc in services:
        print(f"  - {svc['name'][:60]} (Code: {svc['code']})")
else:
    print(f"Error: {response.text}")
