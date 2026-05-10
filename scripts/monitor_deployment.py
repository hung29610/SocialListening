#!/usr/bin/env python3
"""
Monitor Deployment Status
Liên tục kiểm tra deployment status cho đến khi thành công
"""

import requests
import time
from datetime import datetime

BACKEND_URL = "https://social-listening-backend.onrender.com"
CHECK_INTERVAL = 30  # seconds
MAX_ATTEMPTS = 20  # 10 minutes total

def check_backend_health():
    """Check if backend is responding"""
    try:
        response = requests.get(f"{BACKEND_URL}/docs", timeout=10)
        return response.status_code == 200
    except:
        return False

def test_auth_endpoint():
    """Test the auth/me endpoint specifically"""
    try:
        # Login first
        login_response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            data={"username": "admin@sociallistening.com", "password": "Admin@123456"},
            timeout=10
        )
        
        if login_response.status_code != 200:
            return False, "Login failed"
        
        token = login_response.json()["access_token"]
        
        # Test /api/auth/me
        me_response = requests.get(
            f"{BACKEND_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if me_response.status_code == 200:
            return True, "Success"
        else:
            return False, f"Status {me_response.status_code}"
    except Exception as e:
        return False, str(e)[:50]

def main():
    print("=" * 80)
    print("MONITORING DEPLOYMENT STATUS")
    print("=" * 80)
    print()
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Check interval: {CHECK_INTERVAL} seconds")
    print(f"Max attempts: {MAX_ATTEMPTS} ({MAX_ATTEMPTS * CHECK_INTERVAL // 60} minutes)")
    print()
    print("Waiting for deployment to complete...")
    print()
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        timestamp = datetime.now().strftime('%H:%M:%S')
        
        # Check backend health
        if not check_backend_health():
            print(f"[{timestamp}] Attempt {attempt}/{MAX_ATTEMPTS}: ❌ Backend is down")
            time.sleep(CHECK_INTERVAL)
            continue
        
        # Test auth endpoint
        success, message = test_auth_endpoint()
        
        if success:
            print(f"[{timestamp}] Attempt {attempt}/{MAX_ATTEMPTS}: ✅ {message}")
            print()
            print("=" * 80)
            print("🎉 DEPLOYMENT SUCCESSFUL!")
            print("=" * 80)
            print()
            print("Backend is now responding correctly.")
            print("Run this command to test all endpoints:")
            print("  python scripts/test_all_endpoints.py")
            print()
            return True
        else:
            print(f"[{timestamp}] Attempt {attempt}/{MAX_ATTEMPTS}: ⚠️  {message}")
        
        if attempt < MAX_ATTEMPTS:
            time.sleep(CHECK_INTERVAL)
    
    print()
    print("=" * 80)
    print("⏰ TIMEOUT - Deployment taking longer than expected")
    print("=" * 80)
    print()
    print("Possible issues:")
    print("1. Render is still deploying (check dashboard)")
    print("2. Build failed (check Render logs)")
    print("3. Code has errors (check Render logs)")
    print()
    print("Next steps:")
    print("1. Check Render dashboard: https://dashboard.render.com")
    print("2. View deployment logs")
    print("3. Try manual deploy if needed")
    print()
    return False

if __name__ == "__main__":
    main()
