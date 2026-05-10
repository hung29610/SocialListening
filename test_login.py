import requests

API_URL = "https://social-listening-backend.onrender.com"

# Login credentials
login_data = {
    "username": "admin@sociallistening.com",  # OAuth2 uses 'username' field
    "password": "Admin@123456"
}

print("Testing login...")
print(f"Email: {login_data['username']}")

response = requests.post(
    f"{API_URL}/api/auth/login",
    data=login_data  # OAuth2 uses form data, not JSON
)

if response.status_code == 200:
    print("✅ Login successful!")
    token_data = response.json()
    print(f"Access Token: {token_data['access_token'][:50]}...")
    print(f"Token Type: {token_data['token_type']}")
else:
    print(f"❌ Error: {response.status_code}")
    print(f"Response: {response.text}")
