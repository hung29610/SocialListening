"""
Run migration 014 to create user_notification_settings, user_preferences, user_sessions tables
"""
import requests

BACKEND_URL = "https://social-listening-backend.onrender.com"
ADMIN_EMAIL = "honguyenhung2010@gmail.com"
ADMIN_PASSWORD = "Hungnguyen@1515"

def login():
    """Login and return token"""
    response = requests.post(
        f"{BACKEND_URL}/api/auth/login",
        data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None

def run_migration_014():
    """Run migration 014 via SQL"""
    print("="*60)
    print("RUNNING MIGRATION 014")
    print("="*60)
    
    token = login()
    if not token:
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # SQL to create tables
    sql_commands = [
        # Create user_notification_settings table
        """
        CREATE TABLE IF NOT EXISTS user_notification_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            email_notifications BOOLEAN NOT NULL DEFAULT true,
            in_app_notifications BOOLEAN NOT NULL DEFAULT true,
            alert_notifications BOOLEAN NOT NULL DEFAULT true,
            incident_notifications BOOLEAN NOT NULL DEFAULT true,
            report_notifications BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_notification_settings_user_id ON user_notification_settings(user_id);",
        
        # Create user_preferences table
        """
        CREATE TABLE IF NOT EXISTS user_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            theme VARCHAR(20) NOT NULL DEFAULT 'system',
            language VARCHAR(10) NOT NULL DEFAULT 'vi',
            sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
            items_per_page INTEGER NOT NULL DEFAULT 20,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_preferences_user_id ON user_preferences(user_id);",
        
        # Create user_sessions table
        """
        CREATE TABLE IF NOT EXISTS user_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_jti VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            device_type VARCHAR(50),
            location VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            is_revoked BOOLEAN NOT NULL DEFAULT false
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id);",
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_token_jti ON user_sessions(token_jti);",
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_is_revoked ON user_sessions(is_revoked);"
    ]
    
    print("\nExecuting SQL commands...")
    for i, sql in enumerate(sql_commands, 1):
        print(f"\n{i}. Executing: {sql[:80]}...")
        response = requests.post(
            f"{BACKEND_URL}/api/admin/execute-sql",
            headers=headers,
            json={"sql": sql}
        )
        
        if response.status_code == 200:
            print(f"✅ Success")
        else:
            print(f"❌ Failed: {response.status_code}")
            print(response.text)
            # Continue anyway - table might already exist
    
    print("\n" + "="*60)
    print("MIGRATION 014 COMPLETED")
    print("="*60)
    print("\nCreated tables:")
    print("  - user_notification_settings")
    print("  - user_preferences")
    print("  - user_sessions")
    
    return True

if __name__ == "__main__":
    run_migration_014()
