# 👤 THÔNG TIN TÀI KHOẢN ADMIN

## ✅ Tài khoản đã được tạo thành công!

### 📝 Thông tin đăng nhập

```
Email:    honguyenhung2010@gmail.com
Password: Hungnguyen@1515
```

### 🔐 Quyền hạn

- **Is Superuser:** TRUE
- **Full Admin Access:** ✅
- **Tất cả quyền năng:** ✅

### 🌐 Đăng nhập

**URL:** https://social-listening-azure.vercel.app/login

**Các bước:**
1. Mở link trên
2. Nhập email: `honguyenhung2010@gmail.com`
3. Nhập password: `Hungnguyen@1515`
4. Click "Đăng nhập"

---

## 🎯 Quyền năng Admin

Với tài khoản này, bạn có thể:

### 1. Quản lý Dịch vụ ✅
- Xem tất cả yêu cầu dịch vụ
- Phê duyệt/Từ chối yêu cầu
- Bắt đầu xử lý
- Hoàn thành yêu cầu
- Xem dashboard summary

### 2. Quản lý Keywords ✅
- Tạo/Xóa nhóm từ khóa
- Thêm/Xóa từ khóa
- Bật/Tắt từ khóa

### 3. Quản lý Sources ✅
- Thêm/Xóa nguồn
- Cấu hình lịch crawl
- Bật/Tắt nguồn

### 4. Quản lý Mentions ✅
- Xem tất cả mentions
- Xóa mentions
- Tạo alerts từ mentions
- Tạo incidents từ mentions

### 5. Quản lý Alerts ✅
- Xem tất cả alerts
- Acknowledge alerts
- Resolve alerts
- Xóa alerts

### 6. Quản lý Incidents ✅
- Xem tất cả incidents
- Cập nhật trạng thái
- Đóng incidents
- Xem/Thêm logs

### 7. Quản lý Reports ✅
- Tạo báo cáo
- Xem báo cáo
- Xóa báo cáo

### 8. Dashboard ✅
- Xem tổng quan hệ thống
- Thống kê toàn bộ

---

## 🔍 Kiểm tra tài khoản

### Qua Web UI
1. Đăng nhập vào https://social-listening-azure.vercel.app/login
2. Vào Dashboard
3. Kiểm tra có thể truy cập tất cả các trang

### Qua API
```bash
# Login
curl -X POST "https://social-listening-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=honguyenhung2010@gmail.com&password=Hungnguyen@1515"

# Get user info
curl -X GET "https://social-listening-backend.onrender.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Thông tin Database

**User ID:** 3  
**Email:** honguyenhung2010@gmail.com  
**Full Name:** Ho Nguyen Hung  
**Is Superuser:** TRUE  
**Is Active:** TRUE  
**Created:** Đã tồn tại, được cập nhật thành superuser

---

## 🔒 Bảo mật

### Khuyến nghị:
1. ✅ Không chia sẻ mật khẩu
2. ✅ Đổi mật khẩu định kỳ
3. ✅ Sử dụng HTTPS khi truy cập
4. ✅ Đăng xuất sau khi sử dụng

### Đổi mật khẩu:
Hiện tại chưa có chức năng đổi mật khẩu trên UI. Nếu cần đổi, liên hệ dev hoặc chạy script update.

---

## 🆘 Troubleshooting

### Không đăng nhập được?
1. Kiểm tra email và password chính xác
2. Kiểm tra backend có đang chạy không (https://social-listening-backend.onrender.com)
3. Xóa cache browser và thử lại
4. Thử đăng nhập bằng tài khoản admin cũ: `admin@sociallistening.com` / `Admin@123456`

### Không thấy quyền admin?
1. Kiểm tra `is_superuser` trong database
2. Chạy lại script: `python scripts/create_admin_via_api.py`
3. Đăng xuất và đăng nhập lại

### Backend sleep (Render free tier)?
- Đợi 30-60 giây cho backend wake up
- Refresh trang

---

## 📞 Liên hệ

Nếu có vấn đề với tài khoản admin:
1. Chạy script kiểm tra: `python scripts/create_admin_via_api.py`
2. Kiểm tra database trực tiếp
3. Xem backend logs trên Render

---

**Tạo lúc:** 11/05/2026  
**Status:** ✅ Hoạt động  
**Verified:** ✅ Login thành công  
**API Test:** ✅ Passed
