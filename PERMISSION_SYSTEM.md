# 🔐 HỆ THỐNG PHÂN QUYỀN

## 📋 Tổng quan

Hệ thống có 2 loại user:
1. **Normal User** (`is_superuser = FALSE`)
2. **Admin/Superuser** (`is_superuser = TRUE`)

---

## 👤 Phân quyền chi tiết

### Normal User (User thường)

**Có thể:**
- ✅ Đăng nhập vào hệ thống
- ✅ Xem dashboard
- ✅ Tạo/Xem/Xóa keywords của mình
- ✅ Tạo/Xem/Xóa sources của mình
- ✅ Xem mentions
- ✅ Tạo alerts từ mentions
- ✅ Tạo incidents
- ✅ Tạo service requests
- ✅ Xem service catalog
- ✅ Xem service requests của mình
- ✅ Tạo reports

**Không thể:**
- ❌ Truy cập admin endpoints
- ❌ Phê duyệt service requests
- ❌ Xem service requests của người khác
- ❌ Quản lý users
- ❌ Chạy migrations
- ❌ Seed data

---

### Admin/Superuser (Quản trị viên)

**Có thể làm TẤT CẢ những gì Normal User làm được, PLUS:**
- ✅ Truy cập admin endpoints (`/api/admin/*`)
- ✅ **Phê duyệt/Từ chối service requests**
- ✅ **Bắt đầu xử lý service requests**
- ✅ **Hoàn thành service requests**
- ✅ Xem TẤT CẢ service requests (của mọi người)
- ✅ Xem TẤT CẢ keywords, sources, mentions
- ✅ Quản lý users (nếu có endpoints)
- ✅ Chạy migrations
- ✅ Seed data
- ✅ Xem admin dashboard

---

## 🔧 Cách hoạt động

### Backend Dependencies

```python
# File: backend/app/core/security.py

# Cho tất cả user đã đăng nhập
def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# CHỈ cho admin/superuser
def get_current_superuser(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Admin access required."
        )
    return current_user
```

### Sử dụng trong API

```python
# Endpoint cho tất cả user
@router.get("/services")
def list_services(
    current_user: User = Depends(get_current_active_user)  # ✅ Tất cả user
):
    ...

# Endpoint CHỈ cho admin
@router.post("/admin/seed-services")
def seed_services(
    current_user: User = Depends(get_current_superuser)  # ❌ Chỉ admin
):
    ...
```

---

## 🎯 Endpoints phân quyền

### Public Endpoints (Không cần login)
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký

### User Endpoints (Cần login)
- `GET /api/auth/me` - Thông tin user
- `GET /api/dashboard` - Dashboard
- `GET /api/keywords/*` - Keywords
- `GET /api/sources/*` - Sources
- `GET /api/mentions/*` - Mentions
- `GET /api/alerts/*` - Alerts
- `GET /api/incidents/*` - Incidents
- `GET /api/reports/*` - Reports
- `GET /api/services` - Service catalog
- `GET /api/services/{id}` - Service detail
- `POST /api/service-requests` - Tạo service request
- `GET /api/service-requests` - Xem requests của mình

### Admin-Only Endpoints (Chỉ admin)
- `GET /api/admin/check-admin-status` - ✅ **MỚI** Check admin
- `POST /api/admin/run-migrations` - Chạy migrations
- `POST /api/admin/seed-services` - Seed data
- `GET /api/admin/service-catalog-status` - Check status
- `POST /api/service-requests/{id}/approve` - **Phê duyệt** (sẽ thêm)
- `POST /api/service-requests/{id}/reject` - **Từ chối** (sẽ thêm)
- `POST /api/service-requests/{id}/complete` - **Hoàn thành** (sẽ thêm)

---

## 🧪 Test phân quyền

### Script test
```bash
cd scripts
python test_admin_permissions.py
```

### Kết quả mong đợi

**Admin user (honguyenhung2010@gmail.com):**
```
✅ Can access /api/admin/check-admin-status
✅ Status: 200
✅ Message: "You have admin access!"
```

**Normal user (admin@sociallistening.com):**
```
❌ Cannot access /api/admin/check-admin-status
❌ Status: 403
❌ Message: "Not enough permissions. Admin access required."
```

---

## 📊 Database

### Users table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,  -- ⭐ Trường phân quyền
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

### Kiểm tra user trong database
```sql
-- Xem tất cả users
SELECT id, email, full_name, is_superuser, is_active 
FROM users;

-- Xem chỉ admin
SELECT id, email, full_name 
FROM users 
WHERE is_superuser = TRUE;

-- Cập nhật user thành admin
UPDATE users 
SET is_superuser = TRUE 
WHERE email = 'honguyenhung2010@gmail.com';
```

---

## 🔄 Thêm admin mới

### Cách 1: Qua script
```bash
cd scripts
python create_admin_via_api.py
```

### Cách 2: Qua SQL
```sql
-- Tạo user mới là admin
INSERT INTO users (email, hashed_password, full_name, is_superuser, is_active)
VALUES ('newemail@example.com', 'HASHED_PASSWORD', 'Full Name', TRUE, TRUE);

-- Hoặc cập nhật user hiện tại
UPDATE users 
SET is_superuser = TRUE 
WHERE email = 'existing@example.com';
```

### Cách 3: Qua API (nếu có endpoint)
```bash
curl -X POST "https://social-listening-backend.onrender.com/api/admin/create-admin" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","password":"password","full_name":"Name"}'
```

---

## 🚀 Roadmap phân quyền

### Đã có ✅
- [x] Trường `is_superuser` trong database
- [x] Dependency `get_current_superuser()`
- [x] Endpoint test `/api/admin/check-admin-status`
- [x] Admin user: honguyenhung2010@gmail.com

### Cần thêm 🔜
- [ ] Thêm `get_current_superuser` vào service request actions
  - [ ] Approve endpoint
  - [ ] Reject endpoint
  - [ ] Complete endpoint
- [ ] Admin dashboard riêng
- [ ] User management endpoints (CRUD users)
- [ ] Role-based permissions (nếu cần chi tiết hơn)
- [ ] Audit logs cho admin actions

---

## 🔒 Bảo mật

### Best Practices
1. ✅ Không hardcode admin credentials
2. ✅ Sử dụng JWT tokens
3. ✅ Hash passwords với bcrypt
4. ✅ Check permissions ở backend (không tin frontend)
5. ✅ Log admin actions
6. ✅ Giới hạn số lần login sai

### Lưu ý
- ⚠️  `is_superuser` là boolean đơn giản
- ⚠️  Nếu cần phân quyền phức tạp hơn, dùng Role-Based Access Control (RBAC)
- ⚠️  Hiện tại có bảng `roles` và `permissions` nhưng chưa dùng

---

## 📞 Troubleshooting

### Admin không truy cập được admin endpoints?
1. Check `is_superuser` trong database
2. Check backend đã deploy code mới chưa
3. Đăng xuất và đăng nhập lại
4. Check token có hợp lệ không

### Normal user vẫn truy cập được admin endpoints?
1. Check backend có dùng `get_current_superuser` không
2. Check code đã deploy chưa
3. Check database `is_superuser` của user đó

### Làm sao biết mình là admin?
```bash
# Login và get token
curl -X POST "https://social-listening-backend.onrender.com/api/auth/login" \
  -d "username=YOUR_EMAIL&password=YOUR_PASSWORD"

# Check user info
curl -X GET "https://social-listening-backend.onrender.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Xem is_superuser: true/false
```

---

**Cập nhật:** 11/05/2026  
**Status:** ✅ Đã triển khai cơ bản  
**Next:** Thêm admin checks vào service request actions
