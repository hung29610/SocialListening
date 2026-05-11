# 🎛️ HƯỚNG DẪN SỬ DỤNG ADMIN SETTINGS

## 📍 Truy cập

1. **Đăng nhập với tài khoản Admin**
   - Email: `honguyenhung2010@gmail.com`
   - Password: `Hungnguyen@1515`

2. **Vào trang Settings**
   - Click vào **"Cài đặt"** ở sidebar (icon ⚙️)
   - Hoặc truy cập: https://social-listening-azure.vercel.app/dashboard/settings

---

## 👥 QUẢN LÝ NGƯỜI DÙNG

### Xem danh sách người dùng

- Hiển thị tất cả users với thông tin:
  - Email và họ tên
  - Quyền (Quản trị viên / Người dùng)
  - Trạng thái (Hoạt động / Vô hiệu hóa)
  - Ngày tạo

### Thống kê

Dashboard hiển thị:
- **Tổng số người dùng**
- **Đang hoạt động** (is_active = true)
- **Vô hiệu hóa** (is_active = false)
- **Quản trị viên** (is_superuser = true)
- **Người dùng thường** (is_superuser = false)

### Tìm kiếm & Lọc

**Tìm kiếm:**
- Nhập email hoặc tên vào ô search
- Tự động filter kết quả

**Lọc theo trạng thái:**
- Tất cả trạng thái
- Đang hoạt động
- Vô hiệu hóa

**Lọc theo quyền:**
- Tất cả quyền
- Quản trị viên
- Người dùng

### Thêm người dùng mới

1. Click nút **"+ Thêm người dùng"**
2. Điền thông tin:
   - **Email** (bắt buộc)
   - **Mật khẩu** (bắt buộc)
   - **Họ tên** (tùy chọn)
   - ☑ **Quản trị viên** (checkbox)
   - ☑ **Kích hoạt tài khoản** (checkbox)
3. Click **"Tạo mới"**

**Lưu ý:**
- Email phải unique (không trùng)
- Mật khẩu tối thiểu 6 ký tự
- Mặc định tài khoản được kích hoạt

### Sửa thông tin người dùng

1. Click icon **✏️ Sửa** ở hàng user
2. Cập nhật thông tin:
   - Email
   - Họ tên
   - Quyền (Superuser)
   - Trạng thái (Active)
3. Click **"Cập nhật"**

**Lưu ý:**
- Không thể sửa mật khẩu ở đây (dùng Reset Password)
- Email mới không được trùng với user khác

### Đặt lại mật khẩu

1. Click icon **🔑 Key** ở hàng user
2. Nhập mật khẩu mới
3. Xác nhận mật khẩu
4. Click **"Đặt lại mật khẩu"**

**Lưu ý:**
- Mật khẩu tối thiểu 6 ký tự
- Hai mật khẩu phải khớp nhau
- User sẽ phải đăng nhập lại với mật khẩu mới

### Kích hoạt / Vô hiệu hóa

1. Click icon **⚡ Power** ở hàng user
2. Xác nhận trong dialog
3. Trạng thái sẽ đổi ngay lập tức

**Lưu ý:**
- User bị vô hiệu hóa không thể đăng nhập
- Không thể vô hiệu hóa chính mình
- Có thể kích hoạt lại bất cứ lúc nào

### Xóa người dùng

1. Click icon **🗑️ Trash** ở hàng user
2. Xác nhận trong dialog (màu đỏ)
3. User sẽ bị xóa vĩnh viễn

**Lưu ý:**
- ⚠️ **KHÔNG THỂ HOÀN TÁC**
- Không thể xóa chính mình
- Nên vô hiệu hóa thay vì xóa

---

## 🔐 CÁC TAB KHÁC (Đang phát triển)

### Quản lý quyền
- Tạo roles (Admin, Manager, Analyst, Viewer)
- Gán permissions chi tiết
- Role-based access control

### Thông tin tổ chức
- Tên công ty
- Địa chỉ, điện thoại
- Logo
- Múi giờ, ngôn ngữ

### Cấu hình Email
- SMTP settings
- Email templates
- Test email

### Thông báo
- Kênh thông báo (Email, Slack, Telegram)
- Loại thông báo
- Tần suất gửi

### API & Webhooks
- Tạo API keys
- Quản lý webhooks
- Event subscriptions

### Giao diện
- Upload logo, favicon
- Chọn màu sắc
- Theme (Light/Dark)
- Custom CSS

### Audit Logs
- Lịch sử hoạt động
- Ai làm gì, khi nào
- IP address tracking

---

## 🔒 PHÂN QUYỀN

### Ai có thể truy cập Settings?

**Chỉ Superusers (is_superuser = TRUE)**

Hiện tại có 2 superusers:
1. `honguyenhung2010@gmail.com` (ID: 3)
2. `admin@sociallistening.com` (ID: 1)

### Người dùng thường thấy gì?

- **KHÔNG** thấy menu "Cài đặt" ở sidebar
- **KHÔNG** truy cập được `/dashboard/settings`
- Nếu cố truy cập sẽ nhận lỗi 403 Forbidden

---

## 🧪 KIỂM TRA

### Test User Management API

```bash
python scripts/test_user_management.py
```

Test sẽ kiểm tra:
- ✅ Login với admin
- ✅ Get user statistics
- ✅ List all users
- ✅ Search users
- ✅ Filter users (active, superuser)
- ✅ Create new user
- ✅ Get user by ID
- ✅ Update user
- ✅ Reset password
- ✅ Toggle active status
- ✅ Delete user
- ✅ Verify deletion

### Test Frontend

1. **Login với admin**
   - Email: honguyenhung2010@gmail.com
   - Password: Hungnguyen@1515

2. **Vào Settings**
   - Click "Cài đặt" ở sidebar
   - Kiểm tra 8 tabs hiển thị

3. **Test User Management**
   - Xem danh sách users
   - Tìm kiếm "admin"
   - Lọc "Quản trị viên"
   - Tạo user mới
   - Sửa user
   - Đặt lại mật khẩu
   - Vô hiệu hóa user
   - Xóa user

4. **Test với user thường**
   - Login: admin@sociallistening.com / Admin@123456
   - Kiểm tra KHÔNG thấy "Cài đặt" ở sidebar
   - Thử truy cập `/dashboard/settings` → 403

---

## 📊 API ENDPOINTS

### User Management

```
GET    /api/admin/users                    # List users
POST   /api/admin/users                    # Create user
GET    /api/admin/users/{id}               # Get user
PUT    /api/admin/users/{id}               # Update user
DELETE /api/admin/users/{id}               # Delete user
POST   /api/admin/users/{id}/reset-password
POST   /api/admin/users/{id}/toggle-active
GET    /api/admin/users/stats/summary      # Statistics
```

### Query Parameters

**List users:**
- `skip`: Offset (default: 0)
- `limit`: Limit (default: 100, max: 1000)
- `search`: Search by email or name
- `is_active`: Filter by active status (true/false)
- `is_superuser`: Filter by superuser (true/false)

**Example:**
```
GET /api/admin/users?search=admin&is_active=true&is_superuser=true
```

---

## 🚀 DEPLOYMENT STATUS

### Backend (Render)
- URL: https://social-listening-backend.onrender.com
- Status: ✅ Deployed
- Users router: ✅ Registered at `/api/admin/users`

### Frontend (Vercel)
- URL: https://social-listening-azure.vercel.app
- Status: ⏳ Deploying (auto-deploy from GitHub)
- Settings page: ✅ Created at `/dashboard/settings`

### Kiểm tra deployment:

**Backend:**
```bash
curl https://social-listening-backend.onrender.com/health
```

**Frontend:**
- Truy cập: https://social-listening-azure.vercel.app/dashboard/settings
- Phải login với superuser trước

---

## 📝 NOTES

### Bảo mật
- Tất cả endpoints yêu cầu authentication
- Chỉ superusers có quyền truy cập
- Không thể xóa hoặc vô hiệu hóa chính mình
- Mật khẩu được hash với bcrypt

### Performance
- List users có pagination (default 100)
- Search và filter được optimize
- Statistics được cache

### UX
- Tất cả actions có confirm dialog
- Loading states rõ ràng
- Error messages chi tiết
- Responsive design

---

## 🎯 NEXT STEPS

### Phase 2: Settings System (1 giờ)
- Tạo bảng `settings`
- API endpoints cho settings
- UI cho Organization, Email, Notifications

### Phase 3: Audit Logs (30 phút)
- UI để xem logs
- Filters và search
- Export logs

### Phase 4: Advanced Features (2 giờ)
- Role-based permissions
- API keys & webhooks
- Branding customization

---

**Bạn muốn test ngay không? Hoặc tiếp tục implement các tab khác?**
