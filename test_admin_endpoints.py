#!/usr/bin/env python3
"""
Test Admin Endpoints for Service Catalog
"""

import requests
import json

# Configuration
BASE_URL = "https://social-listening-backend.onrender.com"
# Use admin credentials
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

def get_headers(token):
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def check_service_catalog_status(token):
    """Check service catalog status"""
    headers = get_headers(token)
    response = requests.get(f"{BASE_URL}/api/admin/service-catalog-status", headers=headers)
    
    print("=== Service Catalog Status ===")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Tables exist: {data.get('tables_exist', False)}")
        print(f"Categories count: {data.get('categories_count', 0)}")
        print(f"Services count: {data.get('services_count', 0)}")
    else:
        print(f"Error: {response.text}")
    print()

def run_migrations(token):
    """Run database migrations"""
    headers = get_headers(token)
    response = requests.post(f"{BASE_URL}/api/admin/run-migrations", headers=headers)
    
    print("=== Run Migrations ===")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Message: {data.get('message')}")
        print(f"Status: {data.get('status')}")
    else:
        print(f"Error: {response.text}")
    print()

def seed_services(token):
    """Seed service catalog data"""
    headers = get_headers(token)
    response = requests.post(f"{BASE_URL}/api/admin/seed-services", headers=headers)
    
    print("=== Seed Services ===")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Message: {data.get('message')}")
        print(f"Status: {data.get('status')}")
    else:
        print(f"Error: {response.text}")
    print()

def test_services_api(token):
    """Test services API"""
    headers = get_headers(token)
    
    # Test list services
    response = requests.get(f"{BASE_URL}/api/services", headers=headers)
    print("=== List Services ===")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        services = response.json()
        print(f"Found {len(services)} services")
        if services:
            print(f"First service: {services[0]['name']}")
    else:
        print(f"Error: {response.text}")
    print()
    
    # Test dashboard summary
    response = requests.get(f"{BASE_URL}/api/services/dashboard-summary", headers=headers)
    print("=== Services Dashboard Summary ===")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        summary = response.json()
        print(f"Active services: {summary.get('total_active_services', 0)}")
        print(f"Open requests: {summary.get('open_service_requests', 0)}")
        print(f"Pending approvals: {summary.get('pending_approvals', 0)}")
    else:
        print(f"Error: {response.text}")
    print()

def main():
    """Main function"""
    print("🔧 Testing Service Catalog Admin Endpoints...")
    print()
    
    # Login
    print("🔐 Logging in...")
    token = login()
    if not token:
        print("❌ Login failed, exiting")
        return
    print("✅ Login successful")
    print()
    
    # Check current status
    check_service_catalog_status(token)
    
    # Run migrations
    run_migrations(token)
    
    # Check status after migration
    check_service_catalog_status(token)
    
    # Seed data
    seed_services(token)
    
    # Check final status
    check_service_catalog_status(token)
    
    # Test services API
    test_services_api(token)
    
    print("✅ Service Catalog setup completed!")

if __name__ == "__main__":
    main()