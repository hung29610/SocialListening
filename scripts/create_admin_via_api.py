"""
Create admin user via backend API
This bypasses local bcrypt issues
"""
import requests
import psycopg2

BASE_URL = "https://social-listening-backend.onrender.com"
DATABASE_URL = "postgresql://social_listening_db_v2_user:6F6oJaZmFDi5xIDGd4lvALUkQIpsxVkQ@dpg-d7vfpv3rjlhs73dnrgf0-a.oregon-postgres.render.com/social_listening_db_v2"

def create_admin():
    print("=" * 80)
    print("CREATING ADMIN USER VIA API")
    print("=" * 80)
    
    email = "honguyenhung2010@gmail.com"
    password = "Hungnguyen@1515"
    full_name = "Ho Nguyen Hung"
    
    print(f"\n📝 Admin details:")
    print(f"   Email: {email}")
    print(f"   Password: {password}")
    print(f"   Full Name: {full_name}")
    
    # Step 1: Try to register (this will hash password on backend)
    print(f"\n📝 Step 1: Registering user via API...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": full_name
            }
        )
        
        if response.status_code == 200:
            print(f"✅ User registered successfully!")
            user_data = response.json()
            user_id = user_data.get("id")
            print(f"   User ID: {user_id}")
        elif response.status_code == 400 and "already registered" in response.text.lower():
            print(f"⚠️  User already exists, will update in database...")
            user_id = None
        else:
            print(f"❌ Registration failed: {response.status_code}")
            print(f"   {response.text}")
            return
    except Exception as e:
        print(f"❌ Error during registration: {str(e)}")
        return
    
    # Step 2: Update user to superuser in database
    print(f"\n🔄 Step 2: Updating user to superuser in database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # Get user ID if we don't have it
        if not user_id:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            result = cur.fetchone()
            if result:
                user_id = result[0]
                print(f"   Found user ID: {user_id}")
            else:
                print(f"❌ User not found in database!")
                return
        
        # Update to superuser
        cur.execute("""
            UPDATE users 
            SET is_superuser = TRUE, 
                is_active = TRUE,
                full_name = %s
            WHERE id = %s
        """, (full_name, user_id))
        
        conn.commit()
        print(f"✅ User updated to superuser!")
        
        # Verify
        cur.execute("""
            SELECT id, email, full_name, is_superuser, is_active 
            FROM users 
            WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        if user:
            print(f"\n✅ User verified in database!")
            print(f"   ID: {user[0]}")
            print(f"   Email: {user[1]}")
            print(f"   Full Name: {user[2]}")
            print(f"   Is Superuser: {user[3]}")
            print(f"   Is Active: {user[4]}")
        
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
    
    # Step 3: Test login
    print(f"\n🔐 Step 3: Testing login...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Login successful!")
            print(f"   Token: {token[:50]}...")
            
            # Get user info
            user_response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if user_response.status_code == 200:
                user_data = user_response.json()
                print(f"\n✅ User info from API:")
                print(f"   ID: {user_data.get('id')}")
                print(f"   Email: {user_data.get('email')}")
                print(f"   Full Name: {user_data.get('full_name')}")
                print(f"   Is Superuser: {user_data.get('is_superuser')}")
                print(f"   Is Active: {user_data.get('is_active')}")
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   {response.text}")
    except Exception as e:
        print(f"❌ Login test error: {str(e)}")
    
    print("\n" + "=" * 80)
    print("✅ ADMIN CREATION COMPLETED!")
    print("=" * 80)
    print(f"\n📝 Login credentials:")
    print(f"   Email: {email}")
    print(f"   Password: {password}")
    print(f"   Is Superuser: TRUE (Full Admin Access)")
    print(f"\n🌐 Login URL:")
    print(f"   https://social-listening-azure.vercel.app/login")
    print("\n")

if __name__ == "__main__":
    create_admin()
