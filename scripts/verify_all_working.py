"""
Verify all main endpoints are working after hotfix
"""
import requests
import json

BASE_URL = "https://social-listening-backend.onrender.com"
ADMIN_EMAIL = "honguyenhung2010@gmail.com"
ADMIN_PASSWORD = "Hungnguyen@1515"

def test_endpoint(name, method, url, token, data=None):
    headers = {"Authorization": f"Bearer {token}"}
    if data:
        headers["Content-Type"] = "application/json"
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, headers=headers, json=data)
    
    status = "✅" if response.status_code in [200, 201] else "❌"
    print(f"{status} {name}: {response.status_code}")
    
    if response.status_code not in [200, 201]:
        print(f"   Error: {response.text[:200]}")
    
    return response.status_code in [200, 201]

print("="*60)
print("  🧪 VERIFY ALL ENDPOINTS WORKING")
print("="*60)

# Login
print("\n1. Login...")
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

if response.status_code != 200:
    print(f"❌ Login failed: {response.text}")
    exit(1)

token = response.json()["access_token"]
print("✅ Login successful\n")

# Test all main endpoints
print("2. Testing main endpoints...\n")

results = []
results.append(test_endpoint("Dashboard", "GET", f"{BASE_URL}/api/dashboard/summary", token))
results.append(test_endpoint("Keywords Groups", "GET", f"{BASE_URL}/api/keywords/groups", token))
results.append(test_endpoint("Sources", "GET", f"{BASE_URL}/api/sources", token))
results.append(test_endpoint("Mentions", "GET", f"{BASE_URL}/api/mentions", token))
results.append(test_endpoint("Alerts", "GET", f"{BASE_URL}/api/alerts", token))
results.append(test_endpoint("Incidents", "GET", f"{BASE_URL}/api/incidents", token))
results.append(test_endpoint("Services", "GET", f"{BASE_URL}/api/services", token))
results.append(test_endpoint("Service Requests", "GET", f"{BASE_URL}/api/service-requests", token))
results.append(test_endpoint("Users", "GET", f"{BASE_URL}/api/admin/users", token))
results.append(test_endpoint("User Stats", "GET", f"{BASE_URL}/api/admin/users/stats/summary", token))

print("\n" + "="*60)
passed = sum(results)
total = len(results)
print(f"  RESULTS: {passed}/{total} PASSED")
print("="*60)

if passed == total:
    print("\n🎉 ALL ENDPOINTS WORKING!")
else:
    print(f"\n⚠️  {total - passed} endpoints failed")
