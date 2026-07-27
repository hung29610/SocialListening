import os
import psycopg2

try:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("SELECT id, email, is_active FROM users WHERE email='honguyenhung2010@gmail.com'")
    result = cur.fetchall()
    if result:
        print("User found:", result)
        # Force set password for this user using bcrypt
        import bcrypt
        hashed = bcrypt.hashpw(os.environ["ADMIN_PASSWORD"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute("UPDATE users SET hashed_password=%s WHERE id=%s", (hashed, result[0][0]))
        conn.commit()
        print("Password reset successfully")
    else:
        print("User NOT found in database!")
except Exception as e:
    print("Error:", e)
