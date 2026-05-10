#!/usr/bin/env python3
"""
Comprehensive Smoke Test - Test ALL Sidebar Modules
Tests every module with real API calls and reports failures
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://social-listening-backend.onrender.com"
EMAIL = "admin@sociallistening.com"
PASSWORD = "Admin@123456"

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.total = 0
    
    def add_pass(self, module, endpoint, method):
        self.passed.append(f"{module} - {method} {endpoint}")
        self.total += 1
    
    def add_fail(self, module, endpoint, method, status, error, payload=None, traceback=None):
        self.failed.append({
            "module": module,
            "endpoint": endpoint,
            "method": method,
            "status": status,
            "error": error,
            "payload": payload,
            "traceback": traceback
        })
        self.total += 1
    
    def print_summary(self):
        print("\n" + "=" * 80)
        print("SMOKE TEST SUMMARY")
        print("=" * 80)
        print(f"Total tests: {self.total}")
        print(f"Passed: {len(self.passed)} ✅")
        print(f"Failed: {len(self.failed)} ❌")
        print()
        
        if self.failed:
            print("=" * 80)
            print("FAILED TESTS - DETAILED REPORT")
            print("=" * 80)
            for i, fail in enumerate(self.failed, 1):
                print(f"\n{i}. {fail['module']} - {fail['method']} {fail['endpoint']}")
                print(f"   Status: {fail['status']}")
                print(f"   Error: {fail['error'][:200]}")
                if fail['payload']:
                    print(f"   Payload: {json.dumps(fail['payload'], indent=2)[:200]}")
                if fail['traceback']:
                    print(f"   Traceback: {fail['traceback'][:300]}")
                print()

result = TestResult()

def login():
    """Login and get token"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": EMAIL, "password": PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()["access_token"]
    except Exception as e:
        print(f"❌ Login failed: {e}")
    return None

def test_endpoint(module, method, endpoint, headers, data=None, json_data=None):
    """Test a single endpoint"""
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        elif method == "POST":
            if json_data:
                response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=json_data, timeout=10)
            else:
                response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, data=data, timeout=10)
        elif method == "PUT":
            response = requests.put(f"{BASE_URL}{endpoint}", headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        
        if response.status_code in [200, 201, 204]:
            result.add_pass(module, endpoint, method)
            print(f"✅ {module:20} {method:6} {endpoint}")
            return True, response
        else:
            error = response.text[:500]
            traceback = None
            if 'Traceback' in error or 'Error' in error:
                traceback = error
            result.add_fail(module, endpoint, method, response.status_code, error, json_data, traceback)
            print(f"❌ {module:20} {method:6} {endpoint} - {response.status_code}")
            return False, response
    
    except Exception as e:
        result.add_fail(module, endpoint, method, "Exception", str(e), json_data)
        print(f"❌ {module:20} {method:6} {endpoint} - Exception: {str(e)[:50]}")
        return False, None

def main():
    print("=" * 80)
    print("COMPREHENSIVE SMOKE TEST - ALL MODULES")
    print("=" * 80)
    print()
    
    # Login
    print("🔐 Logging in...")
    token = login()
    if not token:
        print("❌ Cannot proceed without login")
        return
    print("✅ Login successful\n")
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # 1. AUTH MODULE
    print("\n📋 Testing AUTH Module...")
    test_endpoint("Auth", "GET", "/api/auth/me", headers)
    
    # 2. DASHBOARD MODULE
    print("\n📋 Testing DASHBOARD Module...")
    test_endpoint("Dashboard", "GET", "/api/dashboard", headers)
    
    # 3. KEYWORDS MODULE
    print("\n📋 Testing KEYWORDS Module...")
    test_endpoint("Keywords", "GET", "/api/keywords/groups", headers)
    success, resp = test_endpoint("Keywords", "POST", "/api/keywords/groups", headers, json_data={
        "name": f"Test Group {datetime.now().timestamp()}",
        "description": "Smoke test",
        "priority": 3,
        "alert_threshold": 70.0,
        "is_active": True
    })
    
    group_id = None
    if success and resp:
        try:
            group_id = resp.json()["id"]
        except:
            pass
    
    if group_id:
        test_endpoint("Keywords", "GET", f"/api/keywords/groups/{group_id}", headers)
        test_endpoint("Keywords", "POST", "/api/keywords/keywords", headers, json_data={
            "group_id": group_id,
            "keyword": "test keyword",
            "keyword_type": "general",
            "logic_operator": "or",
            "is_excluded": False,
            "is_active": True
        })
    
    # 4. SOURCES MODULE
    print("\n📋 Testing SOURCES Module...")
    test_endpoint("Sources", "GET", "/api/sources", headers)
    test_endpoint("Sources", "GET", "/api/sources/groups", headers)
    test_endpoint("Sources", "POST", "/api/sources", headers, json_data={
        "name": f"Test Source {datetime.now().timestamp()}",
        "source_type": "website",
        "url": "https://example.com",
        "is_active": True,
        "crawl_frequency": "manual"
    })
    
    # 5. SCAN CENTER MODULE
    print("\n📋 Testing SCAN CENTER Module...")
    test_endpoint("Scan", "GET", "/api/crawl/scan-history", headers)
    test_endpoint("Scan", "GET", "/api/crawl/jobs", headers)
    if group_id:
        test_endpoint("Scan", "POST", "/api/crawl/manual-scan", headers, json_data={
            "keyword_group_ids": [group_id],
            "source_ids": []
        })
    
    # 6. MENTIONS MODULE
    print("\n📋 Testing MENTIONS Module...")
    test_endpoint("Mentions", "GET", "/api/mentions", headers)
    
    # 7. ALERTS MODULE
    print("\n📋 Testing ALERTS Module...")
    test_endpoint("Alerts", "GET", "/api/alerts", headers)
    
    # 8. INCIDENTS MODULE
    print("\n📋 Testing INCIDENTS Module...")
    test_endpoint("Incidents", "GET", "/api/incidents", headers)
    test_endpoint("Incidents", "POST", "/api/incidents", headers, json_data={
        "title": f"Test Incident {datetime.now().timestamp()}",
        "description": "Smoke test incident",
        "severity": "medium",
        "status": "open",
        "priority": "medium"
    })
    
    # 9. SERVICES MODULE
    print("\n📋 Testing SERVICES Module...")
    test_endpoint("Services", "GET", "/api/services/dashboard-summary", headers)
    test_endpoint("Services", "GET", "/api/services/categories", headers)
    test_endpoint("Services", "GET", "/api/services", headers)
    test_endpoint("Services", "GET", "/api/services/requests", headers)
    
    # 10. REPORTS MODULE
    print("\n📋 Testing REPORTS Module...")
    test_endpoint("Reports", "GET", "/api/reports", headers)
    
    # 11. TAKEDOWN/LEGAL MODULE
    print("\n📋 Testing TAKEDOWN Module...")
    test_endpoint("Takedown", "GET", "/api/takedown/requests", headers)
    
    # Print summary
    result.print_summary()

if __name__ == "__main__":
    main()
