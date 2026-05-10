# 🚨 Hướng Dẫn Manual Deploy Trên Render

## ⚠️ Vấn Đề Hiện Tại

Render đã start backend nhưng **CHƯA deploy code mới nhất**:
- ❌ Auth /me vẫn lỗi Pydantic v2 (code cũ)
- ❌ Sources vẫn thiếu columns (migration 004 chưa chạy)

**Nguyên nhân:** Render có thể:
1. Chưa detect commit mới từ GitHub
2. Auto-deploy bị tắt
3. Đang cache code cũ

---

## 🔧 Giải Pháp: Trigger Manual Deploy

### Bước 1: Vào Render Dashboard
1. Mở trình duyệt
2. Vào: https://dashboard.render.com/
3. Đăng nhập (nếu chưa đăng nhập)

### Bước 2: Chọn Service
1. Tìm service: **social-listening-backend**
2. Click vào service đó

### Bước 3: Trigger Manual Deploy
1. Ở góc trên bên phải, tìm nút **"Manual Deploy"**
2. Click vào nút đó
3. Chọn: **"Deploy latest commit"** hoặc **"Clear build cache & deploy"**
4. Click **"Deploy"**

### Bước 4: Đợi Deploy Hoàn Thành
1. Xem tab **"Logs"** để theo dõi quá trình deploy
2. Tìm các dòng quan trọng:

**Dòng 1: Build thành công**
```
Successfully installed pydantic-1.10.13 ...
```

**Dòng 2: Migration 004 được chạy**
```
INFO  [alembic.runtime.migration] Running upgrade 003_add_service_catalog -> 004_fix_schema_ensure_columns
```
→ **QUAN TRỌNG:** Nếu thấy dòng này = migration đã chạy thành công!

**Dòng 3: Backend start**
```
INFO:     Uvicorn running on http://0.0.0.0:10000
==> Your service is live 🎉
```

### Bước 5: Verify Deploy Thành Công
Sau khi thấy "Your service is live", chạy test:

```bash
cd scripts
python test_production_fixes.py
```

**Kết quả mong đợi:**
```
✅ PASS  Auth Login
✅ PASS  Auth /me (Pydantic v1)
✅ PASS  Sources List (Migration 004)
✅ PASS  Source Groups

Result: 4/4 tests passed (100%)
🎉 ALL TESTS PASSED!
```

---

## 🔍 Kiểm Tra Logs Chi Tiết

### Nếu Không Thấy Migration 004 Chạy

**Tìm dòng này trong logs:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 003_add_service_catalog -> 004_fix_schema_ensure_columns
```

**Nếu KHÔNG thấy dòng "Running upgrade ... -> 004":**
- Có thể Alembic nghĩ database đã ở revision 004
- Hoặc migration file chưa được deploy

**Giải pháp:**
1. Chọn "Clear build cache & deploy" thay vì "Deploy latest commit"
2. Hoặc SSH vào Render và chạy manual: `alembic upgrade head`

---

## 🐛 Troubleshooting

### Vấn Đề 1: Vẫn Lỗi Pydantic v2 Sau Deploy
**Triệu chứng:**
```
You must set the config attribute `from_attributes=True` to use from_orm
```

**Nguyên nhân:** Code cũ vẫn đang chạy

**Giải pháp:**
1. Verify commit trên Render:
   - Trong Render dashboard, xem "Latest Deploy"
   - Commit hash phải là: `943281e` hoặc mới hơn
2. Nếu commit cũ hơn:
   - Click "Manual Deploy" → "Clear build cache & deploy"
   - Đợi 3-5 phút
   - Test lại

### Vấn Đề 2: Vẫn Thiếu Columns Sau Deploy
**Triệu chứng:**
```
column sources.crawl_frequency does not exist
```

**Nguyên nhân:** Migration 004 chưa chạy

**Giải pháp:**
1. Kiểm tra logs có dòng "Running upgrade ... -> 004" không
2. Nếu không có:
   - Vào Render Shell (nếu có)
   - Chạy: `alembic current` để xem revision hiện tại
   - Chạy: `alembic upgrade head` để force upgrade
3. Hoặc:
   - Tạo migration mới với tên khác (005)
   - Push lên GitHub
   - Trigger deploy lại

### Vấn Đề 3: Render Không Có Nút "Manual Deploy"
**Nguyên nhân:** Có thể bạn không có quyền deploy

**Giải pháp:**
1. Kiểm tra bạn có phải owner của service không
2. Hoặc push một commit mới lên GitHub để trigger auto-deploy:
   ```bash
   # Tạo commit rỗng để trigger deploy
   git commit --allow-empty -m "Trigger Render deploy"
   git push origin main
   ```

---

## 📊 Checklist Sau Deploy

- [ ] Logs hiển thị "Running upgrade ... -> 004"
- [ ] Logs hiển thị "Your service is live 🎉"
- [ ] Test script: 4/4 tests passed
- [ ] Frontend load được: https://social-listening-azure.vercel.app/dashboard/sources
- [ ] API docs hoạt động: https://social-listening-backend.onrender.com/docs

---

## 🆘 Nếu Vẫn Không Được

Nếu sau khi manual deploy vẫn lỗi:

1. **Chụp màn hình:**
   - Render logs (toàn bộ)
   - Kết quả test script
   - Lỗi trên frontend (nếu có)

2. **Gửi thông tin:**
   - Commit hash hiện tại trên Render
   - Có thấy dòng "Running upgrade ... -> 004" không
   - Kết quả của `python test_production_fixes.py`

3. **Giải pháp dự phòng:**
   - Tôi sẽ tạo migration 005 với logic khác
   - Hoặc tạo script Python để add columns trực tiếp vào database
   - Hoặc connect trực tiếp vào PostgreSQL để chạy SQL manual

---

**Thời gian ước tính:** 3-5 phút cho manual deploy  
**Commit cần deploy:** `943281e` hoặc mới hơn  
**Migration cần chạy:** `004_fix_schema_ensure_columns`
