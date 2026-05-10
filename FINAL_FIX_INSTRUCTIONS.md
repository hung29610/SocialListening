# 🚨 HƯỚNG DẪN FIX CUỐI CÙNG - CHẠY SQL TRỰC TIẾP

## ⚠️ TÌNH HUỐNG

Migrations 008 và 009 KHÔNG chạy được trên Render vì Alembic không tìm thấy migration path.

**Giải pháp:** Chạy SQL trực tiếp vào database, BỎ QUA Alembic hoàn toàn.

---

## 🔧 CÁCH 1: Dùng Render Shell (KHUYẾN NGHỊ)

### Bước 1: Mở Render Shell

1. Vào: https://dashboard.render.com/
2. Click service: **social-listening-backend**
3. Click tab: **"Shell"**
4. Đợi shell load (khoảng 10-20 giây)

### Bước 2: Connect to PostgreSQL

Trong Render shell, chạy:

```bash
# Get database URL from environment
echo $DATABASE_URL

# Connect to PostgreSQL
psql $DATABASE_URL
```

### Bước 3: Chạy SQL

Copy toàn bộ nội dung file `fix_database.sql` và paste vào psql shell.

Hoặc chạy từng lệnh:

```sql
-- Create enum types
CREATE TYPE IF NOT EXISTS crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual');
CREATE TYPE IF NOT EXISTS sourcetype AS ENUM ('facebook_page', 'facebook_group', 'facebook_profile', 'youtube_channel', 'youtube_video', 'website', 'news', 'rss', 'forum', 'manual_url');

-- Drop old crawl_frequency
ALTER TABLE sources DROP COLUMN IF EXISTS crawl_frequency CASCADE;

-- Add all missing columns
ALTER TABLE sources ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS platform_id VARCHAR(255);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_data JSON;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_frequency crawlfrequency DEFAULT 'manual';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_time TIME;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_week INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_month INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_month INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS next_crawl_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0 NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_sources_group_id ON sources (group_id);
CREATE INDEX IF NOT EXISTS ix_sources_crawl_frequency ON sources (crawl_frequency);
```

### Bước 4: Verify

```sql
-- Check sources table
\d sources

-- Should show all 21 columns including crawl_frequency
```

### Bước 5: Exit và Restart

```bash
# Exit psql
\q

# Exit shell
exit
```

Sau đó restart Render service:
- Click: **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🔧 CÁCH 2: Dùng pgAdmin / DBeaver (Alternative)

### Bước 1: Lấy DATABASE_URL

1. Render Dashboard → service → Environment tab
2. Copy giá trị `DATABASE_URL`

**Format:**
```
postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname
```

### Bước 2: Connect với pgAdmin

1. Mở pgAdmin
2. Right-click "Servers" → "Register" → "Server"
3. **General tab:**
   - Name: Render Social Listening
4. **Connection tab:**
   - Host: `dpg-xxxxx-a.oregon-postgres.render.com` (từ DATABASE_URL)
   - Port: `5432`
   - Database: `dbname` (từ DATABASE_URL)
   - Username: `user` (từ DATABASE_URL)
   - Password: `password` (từ DATABASE_URL)
5. Click "Save"

### Bước 3: Chạy SQL

1. Right-click database → "Query Tool"
2. Copy toàn bộ nội dung file `fix_database.sql`
3. Paste vào Query Tool
4. Click "Execute" (F5)

### Bước 4: Verify

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sources' 
ORDER BY ordinal_position;
```

Phải có 21 columns.

### Bước 5: Restart Render Service

---

## 🔧 CÁCH 3: Dùng psql Command Line (Advanced)

### Bước 1: Install psql

**Windows:**
- Download PostgreSQL từ: https://www.postgresql.org/download/windows/
- Hoặc dùng: `choco install postgresql`

**Mac:**
```bash
brew install postgresql
```

### Bước 2: Connect

```bash
# Get DATABASE_URL from Render
set DATABASE_URL=postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname

# Connect
psql %DATABASE_URL%
```

### Bước 3: Chạy SQL File

```bash
# Option 1: Run file directly
psql %DATABASE_URL% < fix_database.sql

# Option 2: Run in psql
psql %DATABASE_URL%
\i fix_database.sql
```

---

## ✅ SAU KHI CHẠY SQL

### 1. Restart Render Service

**Quan trọng:** Phải restart để backend load lại schema!

1. Render Dashboard → service
2. Click: **"Manual Deploy"** → **"Deploy latest commit"**
3. Đợi 2-3 phút

### 2. Test API

```bash
curl https://social-listening-backend.onrender.com/api/sources
```

**Kết quả mong đợi:**
```json
{
  "sources": [],
  "total": 0,
  "page": 1,
  "page_size": 100
}
```

### 3. Test Frontend

Mở: https://social-listening-azure.vercel.app/dashboard/sources

**Kết quả mong đợi:**
- ✅ Trang load không lỗi
- ✅ Không có "Lỗi khi tải danh sách nguồn"
- ✅ Hiển thị "Không có nguồn nào. Hãy thêm nguồn"

### 4. Test Create Source

Click "Thêm nguồn" và tạo source mới.

**Kết quả mong đợi:**
- ✅ Form hiển thị đầy đủ
- ✅ Submit thành công
- ✅ Source mới xuất hiện

---

## 🐛 TROUBLESHOOTING

### Lỗi: "permission denied"

**Giải pháp:** Dùng Render Shell (có full permissions)

### Lỗi: "type already exists"

**Giải pháp:** Bỏ qua, tiếp tục chạy các lệnh tiếp theo

### Lỗi: "column already exists"

**Giải pháp:** Bỏ qua, tiếp tục chạy các lệnh tiếp theo

### SQL Chạy Xong Nhưng Vẫn Lỗi

**Kiểm tra:**
1. Đã restart Render service chưa?
2. Chạy lại: `\d sources` để verify columns
3. Check crawl_frequency type:
   ```sql
   SELECT data_type FROM information_schema.columns 
   WHERE table_name='sources' AND column_name='crawl_frequency';
   ```
   Phải là: `USER-DEFINED` (enum)

---

## 📋 CHECKLIST

- [ ] Mở Render Shell hoặc pgAdmin
- [ ] Connect to PostgreSQL
- [ ] Chạy SQL từ file `fix_database.sql`
- [ ] Verify: `\d sources` có 21 columns
- [ ] Restart Render service
- [ ] Test API: `GET /api/sources` → 200 OK
- [ ] Test Frontend: Trang sources load không lỗi
- [ ] Test Create: Tạo source mới thành công

---

## 🎯 TẠI SAO PHẢI LÀM THẾ NÀY?

**Vấn đề:** Alembic migrations không chạy được vì:
1. Migration chain bị break (001 → 002 conflict)
2. Production database ở revision không xác định
3. Migrations 008, 009 không tìm thấy path từ revision hiện tại

**Giải pháp:** Chạy SQL trực tiếp = Bỏ qua Alembic hoàn toàn

**Ưu điểm:**
- ✅ Chắc chắn 100% sẽ fix được
- ✅ Không phụ thuộc vào Alembic
- ✅ Idempotent (dùng IF NOT EXISTS)
- ✅ Không mất data

---

## 📞 NẾU VẪN KHÔNG ĐƯỢC

Gửi cho tôi:
1. Output của `\d sources` trong psql
2. Kết quả test API
3. Screenshot lỗi trên frontend
4. Render logs sau khi restart

---

**Ưu tiên:** Dùng **Render Shell** (Cách 1) vì đơn giản và có full permissions!

**File SQL:** `fix_database.sql` (đã tạo sẵn)
