#!/usr/bin/env python3
"""
Check Deployment Status
Kiểm tra xem backend đã deploy xong chưa
"""

import requests
import time
from datetime import datetime

BACKEND_URL = "https://social-listening-backend.onrender.com"
FRONTEND_URL = "https://social-listening-azure.vercel.app"

def check_backend():
    """Check if backend is up and responding"""
    try:
        response = requests.get(f"{BACKEND_URL}/docs", timeout=10)
        return response.status_code == 200
    except:
        return False

def check_frontend():
    """Check if frontend is up and responding"""
    try:
        response = requests.get(FRONTEND_URL, timeout=10)
        return response.status_code == 200
    except:
        return False

def get_backend_version():
    """Try to get backend version/health"""
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code == 200:
            return "✅ Backend is up"
        return f"⚠️ Backend returned {response.status_code}"
    except Exception as e:
        return f"❌ Backend is down: {str(e)[:50]}"

def main():
    print("=" * 80)
    print("CHECKING DEPLOYMENT STATUS")
    print("=" * 80)
    print()
    
    print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Check backend
    print("🔍 Checking backend...")
    backend_status = get_backend_version()
    print(f"   {backend_status}")
    print()
    
    # Check frontend
    print("🔍 Checking frontend...")
    if check_frontend():
        print("   ✅ Frontend is up")
    else:
        print("   ❌ Frontend is down")
    print()
    
    # Check if backend is ready for testing
    if check_backend():
        print("=" * 80)
        print("✅ BACKEND IS READY FOR TESTING!")
        print("=" * 80)
        print()
        print("Run this command to test all endpoints:")
        print("  python scripts/test_all_endpoints.py")
        print()
    else:
        print("=" * 80)
        print("⏳ BACKEND IS STILL DEPLOYING...")
        print("=" * 80)
        print()
        print("Render typically takes 2-5 minutes to deploy.")
        print("Wait a bit and run this script again:")
        print("  python scripts/check_deployment.py")
        print()

if __name__ == "__main__":
    main()
