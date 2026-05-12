"""
Quick check: Who is currently logged in?
"""
import requests

BACKEND_URL = "https://social-listening-backend.onrender.com"

# Paste your token from browser localStorage
print("=" * 60)
print("WHO AM I?")
print("=" * 60)
print("\nInstructions:")
print("1. Open browser DevTools (F12)")
print("2. Go to Console tab")
print("3. Type: localStorage.getItem('access_token')")
print("4. Copy the token (without quotes)")
print("5. Paste it below")
print("=" * 60)

token = input("\nPaste your access_token here: ").strip()

if not token:
    print("❌ No token provided")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

print("\n" + "=" * 60)
print("Checking user info...")
print("=" * 60)

response = requests.get(f"{BACKEND_URL}/api/auth/me", headers=headers)

if response.status_code == 200:
    user = response.json()
    print("\n✅ Current User:")
    print(f"   Email: {user['email']}")
    print(f"   Full Name: {user.get('full_name', 'N/A')}")
    print(f"   Is Superuser: {user['is_superuser']}")
    print(f"   Role: {user.get('role', 'NOT RETURNED')}")
    
    role = user.get('role', 'unknown')
    
    print("\n" + "=" * 60)
    if role in ['admin', 'super_admin']:
        print("✅ YOU ARE ADMIN")
        print("   You SHOULD see 'Cài đặt' menu")
        print("   You SHOULD access /dashboard/settings")
    else:
        print("🔒 YOU ARE NORMAL USER")
        print("   You should NOT see 'Cài đặt' menu")
        print("   You should NOT access /dashboard/settings")
    print("=" * 60)
else:
    print(f"\n❌ Failed: {response.status_code}")
    print(response.text)
