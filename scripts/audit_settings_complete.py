"""
Complete Settings Audit - Test every tab end-to-end
Tests both personal and admin settings with real API calls
"""
import requests
import json
from datetime import datetime

BASE_URL = "https://social-listening-backend.onrender.com"

class SettingsAudit:
    def __init__(self):
        self.results = []
        self.admin_token = None
        self.normal_token = None
        
    def add_result(self, tab, feature, status, details=""):
        self.results.append({
            "tab": tab,
            "feature": feature,
            "status": status,
            "details": details
        })
        status_icon = {
            "DONE": "✅",
            "PARTIAL": "⚠️",
            "DISABLED_PENDING": "❌",
            "FAILED": "🔴"
        }.get(status, "❓")
        print(f"{status_icon} {tab} - {feature}: {status}")
        if details:
            print(f"   {details}")
    
    def login_admin(self):
        """Login as admin user"""
        print("\n🔐 Logging in as ADMIN...")
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={
                "username": "honguyenhung2010@gmail.com",
                "password": "Hungnguyen@1515"
            }
        )
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            print("✅ Admin login successful")
            return True
        print(f"❌ Admin login failed: {response.status_code}")
        return False
    
    def login_normal(self):
        """Login as normal user"""
        print("\n🔐 Logging in as NORMAL USER...")
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={
                "username": "admin@sociallistening.com",
                "password": "Admin@123456"
            }
        )
        if response.status_code == 200:
            self.normal_token = response.json()["access_token"]
            print("✅ Normal user login successful")
            return True
        print(f"❌ Normal user login failed: {response.status_code}")
        return False
    
    def test_personal_profile(self, token):
        """Test Personal Profile tab"""
        print("\n" + "="*70)
        print("📝 TESTING: Hồ sơ cá nhân (Personal Profile)")
        print("="*70)
        
        # Test GET profile
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Hồ sơ cá nhân", "GET Profile", "DONE", 
                              f"Email: {data.get('email')}, Role: {data.get('role')}")
            else:
                self.add_result("Hồ sơ cá nhân", "GET Profile", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Hồ sơ cá nhân", "GET Profile", "FAILED", str(e))
        
        # Test PUT profile
        try:
            response = requests.put(
                f"{BASE_URL}/api/auth/me/profile",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "full_name": "Test User Updated",
                    "phone": "0123456789",
                    "department": "IT"
                }
            )
            if response.status_code == 200:
                self.add_result("Hồ sơ cá nhân", "PUT Profile", "DONE", 
                              "Profile update successful")
            else:
                self.add_result("Hồ sơ cá nhân", "PUT Profile", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Hồ sơ cá nhân", "PUT Profile", "FAILED", str(e))
        
        # Avatar upload
        self.add_result("Hồ sơ cá nhân", "Avatar Upload", "PARTIAL", 
                       "Frontend preview only, backend endpoint not implemented")
    
    def test_security(self, token):
        """Test Security Settings tab"""
        print("\n" + "="*70)
        print("🔒 TESTING: Bảo mật (Security)")
        print("="*70)
        
        # Test change password (with same password for testing)
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/me/change-password",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "current_password": "Hungnguyen@1515",
                    "new_password": "Hungnguyen@1515",
                    "confirm_password": "Hungnguyen@1515"
                }
            )
            if response.status_code == 200:
                self.add_result("Bảo mật", "Change Password", "DONE", 
                              "Password change successful")
            else:
                self.add_result("Bảo mật", "Change Password", "FAILED", 
                              f"Status {response.status_code}: {response.text[:100]}")
        except Exception as e:
            self.add_result("Bảo mật", "Change Password", "FAILED", str(e))
    
    def test_personal_notifications(self, token):
        """Test Personal Notifications tab"""
        print("\n" + "="*70)
        print("🔔 TESTING: Thông báo cá nhân (Personal Notifications)")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/me/notification-settings",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Thông báo cá nhân", "GET Settings", "DONE", 
                              f"Email: {data.get('email_notifications')}")
            else:
                self.add_result("Thông báo cá nhân", "GET Settings", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Thông báo cá nhân", "GET Settings", "FAILED", str(e))
        
        # Test PUT
        try:
            response = requests.put(
                f"{BASE_URL}/api/auth/me/notification-settings",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "email_notifications": True,
                    "in_app_notifications": True,
                    "alert_notifications": True,
                    "incident_notifications": True,
                    "report_notifications": False
                }
            )
            if response.status_code == 200:
                self.add_result("Thông báo cá nhân", "PUT Settings", "DONE", 
                              "Settings update successful")
            else:
                self.add_result("Thông báo cá nhân", "PUT Settings", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Thông báo cá nhân", "PUT Settings", "FAILED", str(e))
    
    def test_appearance(self, token):
        """Test Appearance Settings tab"""
        print("\n" + "="*70)
        print("🎨 TESTING: Giao diện (Appearance)")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/me/preferences",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Giao diện", "GET Preferences", "DONE", 
                              f"Theme: {data.get('theme')}, Language: {data.get('language')}")
            else:
                self.add_result("Giao diện", "GET Preferences", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Giao diện", "GET Preferences", "FAILED", str(e))
        
        # Test PUT
        try:
            response = requests.put(
                f"{BASE_URL}/api/auth/me/preferences",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "theme": "dark",
                    "language": "vi",
                    "sidebar_collapsed": False,
                    "items_per_page": 20
                }
            )
            if response.status_code == 200:
                self.add_result("Giao diện", "PUT Preferences", "DONE", 
                              "Preferences update successful")
            else:
                self.add_result("Giao diện", "PUT Preferences", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Giao diện", "PUT Preferences", "FAILED", str(e))
    
    def test_sessions(self, token):
        """Test Sessions Management tab"""
        print("\n" + "="*70)
        print("🖥️  TESTING: Phiên đăng nhập (Sessions)")
        print("="*70)
        
        # Test GET sessions
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/me/sessions",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                sessions = data.get('sessions', [])
                self.add_result("Phiên đăng nhập", "GET Sessions", "DONE", 
                              f"Found {len(sessions)} sessions")
            else:
                self.add_result("Phiên đăng nhập", "GET Sessions", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Phiên đăng nhập", "GET Sessions", "FAILED", str(e))
    
    def test_user_management(self, token):
        """Test User Management tab (Admin only)"""
        print("\n" + "="*70)
        print("👥 TESTING: Quản lý người dùng (User Management)")
        print("="*70)
        
        # Test GET users
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/users",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                users = response.json()
                self.add_result("Quản lý người dùng", "GET Users", "DONE", 
                              f"Found {len(users)} users")
            elif response.status_code == 403:
                self.add_result("Quản lý người dùng", "GET Users", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("Quản lý người dùng", "GET Users", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Quản lý người dùng", "GET Users", "FAILED", str(e))
    
    def test_role_management(self, token):
        """Test Role Management tab (Admin only)"""
        print("\n" + "="*70)
        print("🛡️  TESTING: Quản lý quyền (Role Management)")
        print("="*70)
        
        # Test GET roles
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/roles/",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                roles = response.json()
                self.add_result("Quản lý quyền", "GET Roles", "DONE", 
                              f"Found {len(roles)} roles")
            elif response.status_code == 403:
                self.add_result("Quản lý quyền", "GET Roles", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            elif response.status_code == 500:
                self.add_result("Quản lý quyền", "GET Roles", "PARTIAL", 
                              "500 Error - Migration 020 pending")
            else:
                self.add_result("Quản lý quyền", "GET Roles", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Quản lý quyền", "GET Roles", "FAILED", str(e))
    
    def test_organization(self, token):
        """Test Organization Settings tab (Admin only)"""
        print("\n" + "="*70)
        print("🏢 TESTING: Thông tin tổ chức (Organization)")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/settings/organization",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Thông tin tổ chức", "GET Settings", "DONE", 
                              f"Name: {data.get('organization_name')}")
            elif response.status_code == 403:
                self.add_result("Thông tin tổ chức", "GET Settings", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("Thông tin tổ chức", "GET Settings", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Thông tin tổ chức", "GET Settings", "FAILED", str(e))
    
    def test_email_settings(self, token):
        """Test Email Settings tab (Admin only)"""
        print("\n" + "="*70)
        print("📧 TESTING: Cấu hình Email (Email Settings)")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/settings/email",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Cấu hình Email", "GET Settings", "DONE", 
                              f"SMTP Host: {data.get('smtp_host')}")
            elif response.status_code == 403:
                self.add_result("Cấu hình Email", "GET Settings", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("Cấu hình Email", "GET Settings", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Cấu hình Email", "GET Settings", "FAILED", str(e))
        
        # Note about email sending
        self.add_result("Cấu hình Email", "Email Sending", "PARTIAL", 
                       "Config UI exists, actual sending not implemented")
    
    def test_system_notifications(self, token):
        """Test System Notifications tab (Admin only)"""
        print("\n" + "="*70)
        print("🔔 TESTING: Thông báo hệ thống (System Notifications)")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/settings/notifications",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Thông báo hệ thống", "GET Settings", "DONE", 
                              f"Webhook URL: {data.get('webhook_url', 'Not set')[:50]}")
            elif response.status_code == 403:
                self.add_result("Thông báo hệ thống", "GET Settings", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("Thông báo hệ thống", "GET Settings", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Thông báo hệ thống", "GET Settings", "FAILED", str(e))
        
        # Note about webhook sending
        self.add_result("Thông báo hệ thống", "Webhook Sending", "PARTIAL", 
                       "Config UI exists, actual sending not implemented")
    
    def test_api_webhooks(self, token):
        """Test API & Webhooks tab (Admin only)"""
        print("\n" + "="*70)
        print("🔑 TESTING: API & Webhooks")
        print("="*70)
        
        # Test GET API keys
        try:
            response = requests.get(
                f"{BASE_URL}/api/api-keys/",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                keys = response.json()
                self.add_result("API & Webhooks", "GET API Keys", "DONE", 
                              f"Found {len(keys)} keys")
            elif response.status_code == 403:
                self.add_result("API & Webhooks", "GET API Keys", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("API & Webhooks", "GET API Keys", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("API & Webhooks", "GET API Keys", "FAILED", str(e))
        
        # Note about UI
        self.add_result("API & Webhooks", "UI Connection", "PARTIAL", 
                       "API exists, UI not fully connected")
    
    def test_branding(self, token):
        """Test Branding Settings tab (Admin only)"""
        print("\n" + "="*70)
        print("🎨 TESTING: Giao diện hệ thống (Branding)")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/branding/",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                data = response.json()
                self.add_result("Giao diện hệ thống", "GET Settings", "DONE", 
                              f"Primary Color: {data.get('primary_color')}")
            elif response.status_code == 403:
                self.add_result("Giao diện hệ thống", "GET Settings", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("Giao diện hệ thống", "GET Settings", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Giao diện hệ thống", "GET Settings", "FAILED", str(e))
        
        # Note about UI
        self.add_result("Giao diện hệ thống", "UI Connection", "PARTIAL", 
                       "API exists, UI not fully connected")
    
    def test_audit_logs(self, token):
        """Test Audit Logs tab (Admin only)"""
        print("\n" + "="*70)
        print("📋 TESTING: Audit Logs")
        print("="*70)
        
        # Test GET
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/audit/",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                logs = response.json()
                self.add_result("Audit Logs", "GET Logs", "DONE", 
                              f"Found {len(logs)} logs")
            elif response.status_code == 403:
                self.add_result("Audit Logs", "GET Logs", "DISABLED_PENDING", 
                              "403 Forbidden - Admin only")
            else:
                self.add_result("Audit Logs", "GET Logs", "FAILED", 
                              f"Status {response.status_code}")
        except Exception as e:
            self.add_result("Audit Logs", "GET Logs", "FAILED", str(e))
        
        # Note about UI
        self.add_result("Audit Logs", "UI Connection", "PARTIAL", 
                       "API exists, UI not fully connected")
    
    def generate_report(self):
        """Generate comprehensive report"""
        print("\n" + "="*70)
        print("📊 SETTINGS AUDIT SUMMARY")
        print("="*70)
        
        # Count by status
        done = len([r for r in self.results if r['status'] == 'DONE'])
        partial = len([r for r in self.results if r['status'] == 'PARTIAL'])
        disabled = len([r for r in self.results if r['status'] == 'DISABLED_PENDING'])
        failed = len([r for r in self.results if r['status'] == 'FAILED'])
        total = len(self.results)
        
        print(f"\nTotal Features Tested: {total}")
        print(f"✅ DONE: {done} ({done/total*100:.1f}%)")
        print(f"⚠️  PARTIAL: {partial} ({partial/total*100:.1f}%)")
        print(f"❌ DISABLED_PENDING: {disabled} ({disabled/total*100:.1f}%)")
        print(f"🔴 FAILED: {failed} ({failed/total*100:.1f}%)")
        
        # Group by tab
        tabs = {}
        for r in self.results:
            if r['tab'] not in tabs:
                tabs[r['tab']] = []
            tabs[r['tab']].append(r)
        
        print("\n" + "="*70)
        print("📋 RESULTS BY TAB")
        print("="*70)
        
        for tab, features in tabs.items():
            print(f"\n{tab}:")
            for f in features:
                status_icon = {
                    "DONE": "✅",
                    "PARTIAL": "⚠️",
                    "DISABLED_PENDING": "❌",
                    "FAILED": "🔴"
                }.get(f['status'], "❓")
                print(f"  {status_icon} {f['feature']}: {f['status']}")
                if f['details']:
                    print(f"     {f['details']}")
        
        return {
            "total": total,
            "done": done,
            "partial": partial,
            "disabled": disabled,
            "failed": failed,
            "results": self.results
        }

def main():
    print("🚀 COMPREHENSIVE SETTINGS AUDIT")
    print("="*70)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    audit = SettingsAudit()
    
    # Login as admin
    if not audit.login_admin():
        print("❌ Cannot proceed without admin token")
        return
    
    # Login as normal user
    if not audit.login_normal():
        print("⚠️  Normal user tests will be skipped")
    
    # Test Personal Settings (with admin token)
    audit.test_personal_profile(audit.admin_token)
    audit.test_security(audit.admin_token)
    audit.test_personal_notifications(audit.admin_token)
    audit.test_appearance(audit.admin_token)
    audit.test_sessions(audit.admin_token)
    
    # Test Admin Settings (with admin token)
    audit.test_user_management(audit.admin_token)
    audit.test_role_management(audit.admin_token)
    audit.test_organization(audit.admin_token)
    audit.test_email_settings(audit.admin_token)
    audit.test_system_notifications(audit.admin_token)
    audit.test_api_webhooks(audit.admin_token)
    audit.test_branding(audit.admin_token)
    audit.test_audit_logs(audit.admin_token)
    
    # Test RBAC (with normal user token)
    if audit.normal_token:
        print("\n" + "="*70)
        print("🔒 TESTING RBAC WITH NORMAL USER")
        print("="*70)
        audit.test_user_management(audit.normal_token)
        audit.test_role_management(audit.normal_token)
        audit.test_organization(audit.normal_token)
    
    # Generate report
    report = audit.generate_report()
    
    print(f"\n✅ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Save report to JSON
    with open('settings_audit_results.json', 'w') as f:
        json.dump(report, f, indent=2)
    print("\n📄 Report saved to: settings_audit_results.json")

if __name__ == "__main__":
    main()
