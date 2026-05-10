# 🚀 Deployment Checklist - Đợi Render Deploy Xong

## ✅ Đã Hoàn Thành

- [x] Fix Auth API Pydantic v1 compatibility
- [x] Convert tất cả 11 files từ Pydantic v2 sang v1
- [x] Tạo migration 004 để thêm 5 columns còn thiếu vào sources table
- [x] Commit và push code lên GitHub (commit `943281e`)
- [x] Verify Render start command có `alembic upgrade head`

## ⏳ Đang Chờ

- [ ] **Render deploy xong** (2-5 phút từ lúc push - 16:20)

## 🧪 Cần Kiểm Tra (Sau Khi Render Deploy Xong)

### 1. Chạy Test Script
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

### 2. Kiểm Tra Frontend
Mở: https://social-listening-azure.vercel.app/dashboard/sources

**Kết quả mong đợi:**
- ✅ Không có lỗi "Lỗi khi tải danh sách nguồn"
- ✅ Không có lỗi 500
- ✅ Trang Sources load được
- ✅ Nút "Thêm nguồn" hoạt động

### 3. Kiểm Tra API Docs
Mở: https://social-listening-backend.onrender.com/docs

**Test các endpoint:**
- `POST /api/auth/login` → Nhập email/password → Nhận token
- `GET /api/auth/me` → Authorize với token → Nhận user data (không lỗi)
- `GET /api/sources` → Authorize với token → Nhận danh sách sources (không lỗi "crawl_frequency does not exist")

## 🔍 Nếu Vẫn Lỗi

### Kiểm tra Render Dashboard
1. Vào: https://dashboard.render.com/
2. Click vào service `social-listening-backend`
3. Xem tab "Logs"
4. Tìm dòng:
   ```
   Running upgrade 003_add_service_catalog -> 004_fix_schema_ensure_columns
   ```
   → Nếu thấy dòng này = migration đã chạy thành công

5. Tìm dòng:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:10000
   ```
   → Nếu thấy dòng này = backend đã start thành công

### Nếu Render Không Deploy
1. Click "Manual Deploy" → "Deploy latest commit"
2. Đợi 2-3 phút
3. Chạy lại test script

## 📞 Báo Kết Quả

Sau khi kiểm tra xong, báo lại:
- ✅ Tất cả tests pass → **DONE!**
- ❌ Vẫn còn lỗi → Gửi log từ Render và kết quả test script

---

**Thời gian push code:** 16:20  
**Thời gian kiểm tra tiếp theo:** 16:25 (sau 5 phút)  
**Commit hiện tại:** `943281e`
