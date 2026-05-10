# 🚨 HƯỚNG DẪN FIX KHẨN CẤP

## ⚠️ TÌNH HUỐNG

Migration 007 KHÔNG chạy được trên Render vì:
- Alembic revision bị stuck
- Migration chain bị break
- Production database ở trạng thái không xác định

**Giải pháp:** Chạy SQL trực tiếp vào database, bỏ qua Alembic

---

## 🔧 CÁCH 1: Dùng Script Python (Recommended)

### Bước 1: Lấy DATABASE_URL từ Render

1. Vào: https://dashboard.render.com/
2. Click vào service: `social-listening-backend`
3. Click tab: **"Environment"**
4. Tìm biến: `DATABASE_URL`
5. Click **"Copy"** để copy giá trị

**DATABASE_URL sẽ có dạng:**
```
postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname
```

### Bước 2: Set Environment Variable

**Windows CMD:**
```cmd
set DATABASE_URL=postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname
```

**Windows PowerShell:**
```powershell
$env:DATABASE_URL="postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname"
```

### Bước 3: Chạy Script

```bash
cd scripts
python emergency_fix_sources_schema.py
```

**Kết quả mong đợi:**
```
================================================================================
EMERGENCY FIX: Sources Table Schema
================================================================================

Connecting to database...
✅ Connected successfully!

================================================================================
Executing SQL statements...
================================================================================

[1/16] Executing...
✅ Success

[2/16] Executing...
✅ Success

...

================================================================================
Verifying schema...
================================================================================

✅ Sources table now has 21 columns:
  - id: integer
  - name: character varying
  - url: text
  - source_type: USER-DEFINED
  - is_active: boolean
  - created_at: timestamp with time zone
  - updated_at: timestamp with time zone
  - created_by: integer
  - group_id: integer
  - platform_id: character varying
  - meta_data: json
  - crawl_frequency: USER-DEFINED
  - crawl_time: time without time zone
  - crawl_day_of_week: integer
  - crawl_day_of_month: integer
  - crawl_month: integer
  - next_crawl_at: timestamp with time zone
  - last_crawled_at: timestamp with time zone
  - last_success_at: timestamp with time zone
  - last_error: text
  - crawl_count: integer
  - error_count: integer

✅ crawl_frequency exists with type: USER-DEFINED

================================================================================
✅ EMERGENCY FIX COMPLETE!
================================================================================
```

### Bước 4: Restart Render Service

1. Vào Render dashboard
2. Click service: `social-listening-backend`
3. Click: **"Manual Deploy"** → **"Deploy latest commit"**
4. Hoặc click: **"Restart"** (nếu có nút này)

### Bước 5: Test

```bash
cd scripts
python test_sources_fix.py
```

**Kết quả mong đợi:**
```
✅ PASS  Login
✅ PASS  GET /api/sources
✅ PASS  GET /api/sources/groups
✅ PASS  POST /api/sources

Result: 4/4 tests passed (100%)
🎉 MAIN FIX VERIFIED!
```

---

## 🔧 CÁCH 2: Dùng Render Shell (Alternative)

### Bước 1: Mở Render Shell

1. Vào: https://dashboard.render.com/
2. Click service: `social-listening-backend`
3. Click tab: **"Shell"**
4. Đợi shell load

### Bước 2: Chạy Python Script

```bash
# Trong Render shell
cd /opt/render/project/src
python scripts/emergency_fix_sources_schema.py
```

### Bước 3: Restart Service

Exit shell và restart service như Cách 1

---

## 🔧 CÁCH 3: Dùng PostgreSQL Client (Advanced)

### Bước 1: Connect to Database

Dùng tool như:
- pgAdmin
- DBeaver
- psql command line

**Connection string:** (lấy từ Render Environment)
```
postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname
```

### Bước 2: Chạy SQL

Copy toàn bộ SQL từ file `emergency_fix_sources_schema.py` (phần sql_statements) và chạy trong PostgreSQL client.

### Bước 3: Verify

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sources' 
ORDER BY ordinal_position;
```

Phải có 21 columns.

### Bước 4: Restart Render Service

---

## ✅ SAU KHI FIX

### 1. Test API

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

### 2. Test Frontend

Mở: https://social-listening-azure.vercel.app/dashboard/sources

**Kết quả mong đợi:**
- ✅ Trang load không lỗi
- ✅ Không có "Lỗi khi tải danh sách nguồn"
- ✅ Hiển thị "Không có nguồn nào. Hãy thêm nguồn"

### 3. Test Create Source

Click "Thêm nguồn" và tạo source mới.

**Kết quả mong đợi:**
- ✅ Form hiển thị đầy đủ fields
- ✅ Submit thành công
- ✅ Source mới xuất hiện trong danh sách

---

## 🐛 TROUBLESHOOTING

### Lỗi: "DATABASE_URL not set"

**Giải pháp:**
```bash
# Kiểm tra
echo %DATABASE_URL%  # CMD
echo $env:DATABASE_URL  # PowerShell

# Set lại
set DATABASE_URL=<your_url>  # CMD
$env:DATABASE_URL="<your_url>"  # PowerShell
```

### Lỗi: "Connection failed"

**Nguyên nhân:**
- DATABASE_URL sai
- Database không accessible từ máy local
- Firewall block

**Giải pháp:**
- Verify DATABASE_URL từ Render
- Dùng Render Shell thay vì local
- Check Render database settings

### Lỗi: "Permission denied"

**Nguyên nhân:**
- User không có quyền ALTER TABLE

**Giải pháp:**
- Dùng Render Shell (có full permissions)
- Hoặc contact Render support

### Script Chạy Nhưng Vẫn Lỗi

**Kiểm tra:**
```bash
# Test API
curl https://social-listening-backend.onrender.com/api/sources

# Nếu vẫn lỗi, restart Render service
```

**Nếu vẫn không được:**
1. Check Render logs
2. Verify database schema:
   ```sql
   \d sources
   ```
3. Check crawl_frequency type:
   ```sql
   SELECT data_type FROM information_schema.columns 
   WHERE table_name='sources' AND column_name='crawl_frequency';
   ```

---

## 📞 NẾU VẪN KHÔNG ĐƯỢC

Gửi cho tôi:
1. Output của `python emergency_fix_sources_schema.py`
2. Render logs (toàn bộ)
3. Kết quả test API
4. Screenshot lỗi trên frontend

---

**Ưu tiên:** Dùng **CÁCH 1** (Script Python) vì đơn giản và an toàn nhất!
