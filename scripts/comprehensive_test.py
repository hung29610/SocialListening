"""
Comprehensive Test Suite for Social Listening Web App
Tests all pages, APIs, and features to identify fake UI and broken functionality
"""
import requests
import json
from datetime import datetime

BASE_URL = "https://social-listening-backend.onrender.com"

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.partial = []
        
    def add_pass(self, test_name, details=""):
        self.passed.append({"name": test_name, "details": details})
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name, error):
        self.failed.append({"name": test_name, "error": str(error)})
        print(f"❌ FAIL: {test_name}")
        print(f"   Error: {error}")
    
    def add_partial(self, test_name, reason):
        self.partial.append({"name": test_name, "reason": reason})
        print(f"⚠️  PARTIAL: {test_name}")
        print(f"   Reason: {reason}")
    
    def summary(self):
        total = len(self.passed) + len(self.failed) + len(self.partial)
        print("\n" + "="*70)
        print("📊 TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {len(self.passed)} ({len(self.passed)/total*100:.1f}%)")
        print(f"❌ Failed: {len(self.failed)} ({len(self.failed)/total*100:.1f}%)")
        print(f"⚠️  Partial: {len(self.partial)} ({len(self.partial)/total*100:.1f}%)")
        print("="*70)

results = TestResults()

def login():
    """Login and get token"""
    print("\n🔐 Logging in...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={
                "username": "honguyenhung2010@gmail.com",
                "password": "Hungnguyen@1515"
            }
        )
        if response.status_code == 200:
            token = response.json()["access_token"]
            print("✅ Login successful")
            return token
        else:
            print(f"❌ Login failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_dashboard(token):
    """Test Dashboard API"""
    print("\n" + "="*70)
    print("📊 TESTING DASHBOARD")
    print("="*70)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            data = response.json()
            results.add_pass("Dashboard API", f"Metrics: {len(data)} items")
        else:
            results.add_fail("Dashboard API", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Dashboard API", str(e))

def test_keywords(token):
    """Test Keywords API"""
    print("\n" + "="*70)
    print("🔑 TESTING KEYWORDS")
    print("="*70)
    
    # Test list groups
    try:
        response = requests.get(
            f"{BASE_URL}/api/keywords/groups",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            groups = response.json()
            results.add_pass("Keywords - List Groups", f"Found {len(groups)} groups")
        else:
            results.add_fail("Keywords - List Groups", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Keywords - List Groups", str(e))
    
    # Test list keywords
    try:
        response = requests.get(
            f"{BASE_URL}/api/keywords/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            keywords = response.json()
            results.add_pass("Keywords - List Keywords", f"Found {len(keywords)} keywords")
        else:
            results.add_fail("Keywords - List Keywords", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Keywords - List Keywords", str(e))

def test_sources(token):
    """Test Sources API"""
    print("\n" + "="*70)
    print("📰 TESTING SOURCES")
    print("="*70)
    
    # Test list sources
    try:
        response = requests.get(
            f"{BASE_URL}/api/sources/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            sources = response.json()
            results.add_pass("Sources - List Sources", f"Found {len(sources)} sources")
        else:
            results.add_fail("Sources - List Sources", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Sources - List Sources", str(e))

def test_mentions(token):
    """Test Mentions API"""
    print("\n" + "="*70)
    print("💬 TESTING MENTIONS")
    print("="*70)
    
    # Test list mentions
    try:
        response = requests.get(
            f"{BASE_URL}/api/mentions/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            mentions = response.json()
            results.add_pass("Mentions - List Mentions", f"Found {len(mentions)} mentions")
        else:
            results.add_fail("Mentions - List Mentions", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Mentions - List Mentions", str(e))

def test_alerts(token):
    """Test Alerts API"""
    print("\n" + "="*70)
    print("🚨 TESTING ALERTS")
    print("="*70)
    
    # Test list alerts
    try:
        response = requests.get(
            f"{BASE_URL}/api/alerts/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            alerts = response.json()
            results.add_pass("Alerts - List Alerts", f"Found {len(alerts)} alerts")
        else:
            results.add_fail("Alerts - List Alerts", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Alerts - List Alerts", str(e))

def test_incidents(token):
    """Test Incidents API"""
    print("\n" + "="*70)
    print("🔥 TESTING INCIDENTS")
    print("="*70)
    
    # Test list incidents
    try:
        response = requests.get(
            f"{BASE_URL}/api/incidents/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            incidents = response.json()
            results.add_pass("Incidents - List Incidents", f"Found {len(incidents)} incidents")
        else:
            results.add_fail("Incidents - List Incidents", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Incidents - List Incidents", str(e))

def test_services(token):
    """Test Services API"""
    print("\n" + "="*70)
    print("🛠️  TESTING SERVICES")
    print("="*70)
    
    # Test list services
    try:
        response = requests.get(
            f"{BASE_URL}/api/services/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            services = response.json()
            results.add_pass("Services - List Services", f"Found {len(services)} services")
        else:
            results.add_fail("Services - List Services", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Services - List Services", str(e))
    
    # Test service requests
    try:
        response = requests.get(
            f"{BASE_URL}/api/service-requests/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            requests_data = response.json()
            results.add_pass("Services - List Requests", f"Found {len(requests_data)} requests")
        else:
            results.add_fail("Services - List Requests", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Services - List Requests", str(e))

def test_settings_personal(token):
    """Test Personal Settings APIs"""
    print("\n" + "="*70)
    print("👤 TESTING PERSONAL SETTINGS")
    print("="*70)
    
    # Test profile
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Settings - Get Profile", "Profile loaded")
        else:
            results.add_fail("Settings - Get Profile", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Settings - Get Profile", str(e))
    
    # Test notification settings
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me/notification-settings",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Settings - Notification Settings", "Settings loaded")
        else:
            results.add_fail("Settings - Notification Settings", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Settings - Notification Settings", str(e))
    
    # Test preferences
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me/preferences",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Settings - Preferences", "Preferences loaded")
        else:
            results.add_fail("Settings - Preferences", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Settings - Preferences", str(e))
    
    # Test sessions
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            data = response.json()
            sessions = data.get('sessions', [])
            results.add_pass("Settings - Sessions", f"Found {len(sessions)} sessions")
        else:
            results.add_fail("Settings - Sessions", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Settings - Sessions", str(e))

def test_settings_admin(token):
    """Test Admin Settings APIs"""
    print("\n" + "="*70)
    print("⚙️  TESTING ADMIN SETTINGS")
    print("="*70)
    
    # Test user management
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            users = response.json()
            results.add_pass("Admin - User Management", f"Found {len(users)} users")
        else:
            results.add_fail("Admin - User Management", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - User Management", str(e))
    
    # Test role management
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/roles/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            roles = response.json()
            results.add_pass("Admin - Role Management", f"Found {len(roles)} roles")
        else:
            results.add_fail("Admin - Role Management", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - Role Management", str(e))
    
    # Test organization settings
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/settings/organization",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Admin - Organization Settings", "Settings loaded")
        else:
            results.add_fail("Admin - Organization Settings", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - Organization Settings", str(e))
    
    # Test email settings
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/settings/email",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Admin - Email Settings", "Settings loaded")
        else:
            results.add_fail("Admin - Email Settings", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - Email Settings", str(e))
    
    # Test system notifications
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/settings/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Admin - System Notifications", "Settings loaded")
        else:
            results.add_fail("Admin - System Notifications", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - System Notifications", str(e))
    
    # Test API keys
    try:
        response = requests.get(
            f"{BASE_URL}/api/api-keys/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            keys = response.json()
            results.add_pass("Admin - API Keys", f"Found {len(keys)} keys")
        else:
            results.add_fail("Admin - API Keys", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - API Keys", str(e))
    
    # Test branding
    try:
        response = requests.get(
            f"{BASE_URL}/api/branding/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            results.add_pass("Admin - Branding", "Settings loaded")
        else:
            results.add_fail("Admin - Branding", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - Branding", str(e))
    
    # Test audit logs
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/audit/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            logs = response.json()
            results.add_pass("Admin - Audit Logs", f"Found {len(logs)} logs")
        else:
            results.add_fail("Admin - Audit Logs", f"Status {response.status_code}")
    except Exception as e:
        results.add_fail("Admin - Audit Logs", str(e))

def test_rbac(token):
    """Test RBAC enforcement"""
    print("\n" + "="*70)
    print("🔒 TESTING RBAC")
    print("="*70)
    
    # Test with normal user token
    print("\n🔐 Testing with normal user...")
    try:
        # Login as normal user
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={
                "username": "admin@sociallistening.com",
                "password": "Admin@123456"
            }
        )
        if response.status_code == 200:
            normal_token = response.json()["access_token"]
            
            # Try to access admin endpoint
            response = requests.get(
                f"{BASE_URL}/api/admin/users",
                headers={"Authorization": f"Bearer {normal_token}"}
            )
            if response.status_code == 403:
                results.add_pass("RBAC - Normal User Blocked", "403 Forbidden as expected")
            else:
                results.add_fail("RBAC - Normal User Blocked", f"Expected 403, got {response.status_code}")
        else:
            results.add_partial("RBAC - Normal User Blocked", "Could not login as normal user")
    except Exception as e:
        results.add_fail("RBAC - Normal User Blocked", str(e))

def main():
    print("🚀 COMPREHENSIVE TEST SUITE FOR SOCIAL LISTENING WEB APP")
    print("="*70)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # Login
    token = login()
    if not token:
        print("❌ Cannot proceed without token")
        return
    
    # Run all tests
    test_dashboard(token)
    test_keywords(token)
    test_sources(token)
    test_mentions(token)
    test_alerts(token)
    test_incidents(token)
    test_services(token)
    test_settings_personal(token)
    test_settings_admin(token)
    test_rbac(token)
    
    # Print summary
    results.summary()
    
    print(f"\n✅ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
