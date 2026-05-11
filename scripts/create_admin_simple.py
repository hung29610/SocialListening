"""
Simple script to create admin user directly in database
"""
import psycopg2
from passlib.context import CryptContext

# Database connection
DATABASE_URL = "postgresql://social_listening_db_v2_user:6F6oJaZmFDi5xIDGd4lvALUkQIpsxVkQ@dpg-d7vfpv3rjlhs73dnrgf0-a.oregon-postgres.render.com/social_listening_db_v2"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin():
    print("=" * 80)
    print("CREATING ADMIN USER")
    print("=" * 80)
    
    email = "honguyenhung2010@gmail.com"
    password = "Hungnguyen@1515"
    full_name = "Ho Nguyen Hung"
    
    print(f"\n📝 Admin details:")
    print(f"   Email: {email}")
    print(f"   Password: {password}")
    print(f"   Full Name: {full_name}")
    
    # Hash password
    print(f"\n🔐 Hashing password...")
    hashed_password = pwd_context.hash(password)
    print(f"✅ Password hashed!")
    
    # Connect to database
    print(f"\n🔌 Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # Check if user exists
        print(f"\n🔍 Checking if user exists...")
        cur.execute("SELECT id, is_superuser FROM users WHERE email = %s", (email,))
        existing = cur.fetchone()
        
        if existing:
            user_id, is_superuser = existing
            print(f"⚠️  User already exists (ID: {user_id})")
            print(f"   Current is_superuser: {is_superuser}")
            
            # Update user
            print(f"\n🔄 Updating user...")
            cur.execute("""
                UPDATE users 
                SET hashed_password = %s, 
                    is_superuser = TRUE, 
                    is_active = TRUE,
                    full_name = %s
                WHERE email = %s
            """, (hashed_password, full_name, email))
            
            conn.commit()
            print(f"✅ User updated successfully!")
            print(f"   ID: {user_id}")
            print(f"   Is Superuser: TRUE")
            print(f"   Password: Updated")
        else:
            # Create new user
            print(f"\n➕ Creating new user...")
            cur.execute("""
                INSERT INTO users (email, hashed_password, full_name, is_superuser, is_active)
                VALUES (%s, %s, %s, TRUE, TRUE)
                RETURNING id
            """, (email, hashed_password, full_name))
            
            user_id = cur.fetchone()[0]
            conn.commit()
            
            print(f"✅ User created successfully!")
            print(f"   ID: {user_id}")
            print(f"   Email: {email}")
            print(f"   Full Name: {full_name}")
            print(f"   Is Superuser: TRUE")
        
        # Verify
        print(f"\n✅ Verifying user...")
        cur.execute("SELECT id, email, full_name, is_superuser, is_active FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        
        if user:
            print(f"✅ User verified in database!")
            print(f"   ID: {user[0]}")
            print(f"   Email: {user[1]}")
            print(f"   Full Name: {user[2]}")
            print(f"   Is Superuser: {user[3]}")
            print(f"   Is Active: {user[4]}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
    
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
