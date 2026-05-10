import requests

# Backend URL
API_URL = "https://social-listening-backend.onrender.com"

# Admin user info
admin_data = {
    "email": "admin@admin.com",
    "password": "admin123",
    "full_name": "Administrator"
}

print("Creating admin user...")
print(f"Email: {admin_data['email']}")
print(f"Password: {admin_data['password']}")

# Register admin user
response = requests.post(f"{API_URL}/api/auth/register", json=admin_data)

if response.status_code == 200:
    print("✅ Admin user created successfully!")
    print(f"Response: {response.json()}")
    print("\n=== LOGIN CREDENTIALS ===")
    print(f"Email: {admin_data['email']}")
    print(f"Password: {admin_data['password']}")
    print("========================")
elif response.status_code == 400:
    print(f"⚠️  User already exists: {response.json()}")
    print("\n=== TRY LOGIN WITH ===")
    print(f"Email: {admin_data['email']}")
    print(f"Password: {admin_data['password']}")
    print("======================")
else:
    print(f"❌ Error: {response.status_code}")
    print(f"Response: {response.text}")
