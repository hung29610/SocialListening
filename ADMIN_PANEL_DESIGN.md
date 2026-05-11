# 🎛️ THIẾT KẾ ADMIN PANEL

## 📋 Cấu trúc

```
Dashboard
├── Scan Center
├── Từ khóa
├── Nguồn
├── Mentions
├── Cảnh báo
├── Sự cố
├── Dịch vụ
└── ⚙️ CÀI ĐẶT (MỚI) ⭐
    ├── 👥 Quản lý người dùng
    ├── 🔐 Quản lý quyền
    ├── 🏢 Thông tin tổ chức
    ├── 📧 Cấu hình Email
    ├── 🔔 Cấu hình thông báo
    ├── 🌐 API & Webhooks
    ├── 🎨 Giao diện & Branding
    └── 📊 Logs & Audit Trail
```

---

## 1️⃣ QUẢN LÝ NGƯỜI DÙNG

### Chức năng:
- ✅ Xem danh sách users
- ✅ Thêm user mới
- ✅ Sửa thông tin user
- ✅ Xóa user
- ✅ Kích hoạt/Vô hiệu hóa user
- ✅ Đặt lại mật khẩu
- ✅ Gán quyền (superuser/normal)
- ✅ Xem lịch sử hoạt động

### UI:
```
┌─────────────────────────────────────────────────┐
│ 👥 QUẢN LÝ NGƯỜI DÙNG                    [+ Thêm]│
├─────────────────────────────────────────────────┤
│ 🔍 [Tìm kiếm...]                    [Lọc ▼]     │
├─────────────────────────────────────────────────┤
│ ID │ Email              │ Tên      │ Quyền │ TT │
├────┼────────────────────┼──────────┼───────┼────┤
│ 1  │ admin@...          │ Admin    │ 👑    │ ✅ │
│ 2  │ user@...           │ User     │ 👤    │ ✅ │
│ 3  │ hong...@gmail.com  │ Hung     │ 👑    │ ✅ │
└─────────────────────────────────────────────────┘
```

### Bảng users:
```sql
users (
  id, email, hashed_password, full_name,
  is_active, is_superuser,
  created_at, updated_at, last_login_at
)
```

---

## 2️⃣ QUẢN LÝ QUYỀN

### Hệ thống phân quyền:

#### A. Simple (Hiện tại)
- **Superuser** (is_superuser = TRUE)
- **Normal User** (is_superuser = FALSE)

#### B. Advanced (Tương lai)
- **Roles**: Admin, Manager, Analyst, Viewer
- **Permissions**: 
  - keywords.view, keywords.create, keywords.edit, keywords.delete
  - sources.view, sources.create, sources.edit, sources.delete
  - mentions.view, mentions.delete
  - alerts.view, alerts.manage
  - incidents.view, incidents.manage
  - services.view, services.approve
  - reports.view, reports.create
  - users.view, users.manage
  - settings.view, settings.manage

### UI:
```
┌─────────────────────────────────────────────────┐
│ 🔐 QUẢN LÝ QUYỀN                                 │
├─────────────────────────────────────────────────┤
│ Chế độ: ○ Simple  ● Advanced                    │
├─────────────────────────────────────────────────┤
│ ROLES                                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ 👑 Admin        [Sửa] [Xóa]                 │ │
│ │ 📊 Manager      [Sửa] [Xóa]                 │ │
│ │ 📈 Analyst      [Sửa] [Xóa]                 │ │
│ │ 👁️  Viewer       [Sửa] [Xóa]                 │ │
│ │                 [+ Thêm Role]                │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ PERMISSIONS cho role: Admin                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ ☑ Keywords: View, Create, Edit, Delete      │ │
│ │ ☑ Sources: View, Create, Edit, Delete       │ │
│ │ ☑ Mentions: View, Delete                    │ │
│ │ ☑ Alerts: View, Manage                      │ │
│ │ ☑ Incidents: View, Manage                   │ │
│ │ ☑ Services: View, Approve                   │ │
│ │ ☑ Reports: View, Create                     │ │
│ │ ☑ Users: View, Manage                       │ │
│ │ ☑ Settings: View, Manage                    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 3️⃣ THÔNG TIN TỔ CHỨC

### Cấu hình:
```
┌─────────────────────────────────────────────────┐
│ 🏢 THÔNG TIN TỔ CHỨC                             │
├─────────────────────────────────────────────────┤
│ Tên công ty:     [_________________________]    │
│ Địa chỉ:         [_________________________]    │
│ Điện thoại:      [_________________________]    │
│ Email liên hệ:   [_________________________]    │
│ Website:         [_________________________]    │
│ Logo:            [📁 Upload]                     │
│ Múi giờ:         [GMT+7 - Hanoi ▼]              │
│ Ngôn ngữ:        [Tiếng Việt ▼]                 │
│                                                  │
│                  [Lưu thay đổi]                  │
└─────────────────────────────────────────────────┘
```

---

## 4️⃣ CẤU HÌNH EMAIL

### SMTP Settings:
```
┌─────────────────────────────────────────────────┐
│ 📧 CẤU HÌNH EMAIL                                │
├─────────────────────────────────────────────────┤
│ SMTP Host:       [smtp.gmail.com________]       │
│ SMTP Port:       [587___]                       │
│ Username:        [_________________________]    │
│ Password:        [••••••••••••••••••••••]       │
│ From Email:      [noreply@company.com___]       │
│ From Name:       [Social Listening______]       │
│                                                  │
│ ☑ Sử dụng TLS                                   │
│ ☑ Sử dụng SSL                                   │
│                                                  │
│ [Test Email]     [Lưu cấu hình]                 │
└─────────────────────────────────────────────────┘
```

### Email Templates:
- Alert notification
- Incident created
- Service request approved
- Weekly report
- Password reset

---

## 5️⃣ CẤU HÌNH THÔNG BÁO

### Notification Settings:
```
┌─────────────────────────────────────────────────┐
│ 🔔 CẤU HÌNH THÔNG BÁO                            │
├─────────────────────────────────────────────────┤
│ Kênh thông báo:                                  │
│ ☑ Email                                         │
│ ☑ In-app notification                           │
│ ☐ Slack                                         │
│ ☐ Telegram                                      │
│ ☐ SMS                                           │
│                                                  │
│ Thông báo cho:                                   │
│ ☑ Alert mới (severity >= HIGH)                  │
│ ☑ Incident mới                                  │
│ ☑ Service request cần phê duyệt                 │
│ ☑ Mention có risk_score >= 80                   │
│ ☐ Báo cáo hằng ngày                             │
│ ☑ Báo cáo hằng tuần                             │
│                                                  │
│                  [Lưu cấu hình]                  │
└─────────────────────────────────────────────────┘
```

---

## 6️⃣ API & WEBHOOKS

### API Keys:
```
┌─────────────────────────────────────────────────┐
│ 🌐 API & WEBHOOKS                                │
├─────────────────────────────────────────────────┤
│ API Keys:                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ sk_live_abc123...  [Copy] [Revoke]          │ │
│ │ Created: 2026-05-01  Last used: 2 hours ago │ │
│ └─────────────────────────────────────────────┘ │
│                  [+ Generate New Key]            │
│                                                  │
│ Webhooks:                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://api.example.com/webhook              │ │
│ │ Events: alert.created, incident.created      │ │
│ │ Status: ✅ Active    [Edit] [Delete]         │ │
│ └─────────────────────────────────────────────┘ │
│                  [+ Add Webhook]                 │
└─────────────────────────────────────────────────┘
```

---

## 7️⃣ GIAO DIỆN & BRANDING

### Customization:
```
┌─────────────────────────────────────────────────┐
│ 🎨 GIAO DIỆN & BRANDING                          │
├─────────────────────────────────────────────────┤
│ Logo:            [📁 Upload] [Preview]           │
│ Favicon:         [📁 Upload]                     │
│ Primary Color:   [🎨 #3B82F6]                    │
│ Secondary Color: [🎨 #10B981]                    │
│ Accent Color:    [🎨 #F59E0B]                    │
│                                                  │
│ Theme:           ○ Light  ● Dark  ○ Auto        │
│                                                  │
│ Custom CSS:      [📝 Edit]                       │
│                                                  │
│                  [Preview] [Lưu thay đổi]        │
└─────────────────────────────────────────────────┘
```

---

## 8️⃣ LOGS & AUDIT TRAIL

### Activity Logs:
```
┌─────────────────────────────────────────────────┐
│ 📊 LOGS & AUDIT TRAIL                            │
├─────────────────────────────────────────────────┤
│ 🔍 [Tìm kiếm...]  [Lọc: User ▼] [Action ▼]     │
├─────────────────────────────────────────────────┤
│ Time       │ User      │ Action              │ IP│
├────────────┼───────────┼─────────────────────┼───┤
│ 10:30:15   │ admin@... │ User created        │...│
│ 10:25:42   │ hung@...  │ Service approved    │...│
│ 10:20:11   │ user@...  │ Keyword added       │...│
│ 10:15:33   │ admin@... │ Settings updated    │...│
└─────────────────────────────────────────────────┘
```

---

## 🗂️ CẤU TRÚC FILE

```
frontend/src/app/dashboard/
└── settings/
    ├── page.tsx                    # Settings layout với tabs
    ├── users/
    │   └── page.tsx               # User management
    ├── permissions/
    │   └── page.tsx               # Permission management
    ├── organization/
    │   └── page.tsx               # Organization info
    ├── email/
    │   └── page.tsx               # Email config
    ├── notifications/
    │   └── page.tsx               # Notification settings
    ├── api/
    │   └── page.tsx               # API & Webhooks
    ├── branding/
    │   └── page.tsx               # UI customization
    └── logs/
        └── page.tsx               # Audit logs
```

---

## 🔧 BACKEND API CẦN THÊM

### User Management:
```python
GET    /api/admin/users              # List users
POST   /api/admin/users              # Create user
GET    /api/admin/users/{id}         # Get user
PUT    /api/admin/users/{id}         # Update user
DELETE /api/admin/users/{id}         # Delete user
POST   /api/admin/users/{id}/reset-password
POST   /api/admin/users/{id}/toggle-active
```

### Settings:
```python
GET    /api/admin/settings           # Get all settings
PUT    /api/admin/settings           # Update settings
GET    /api/admin/settings/{key}     # Get specific setting
PUT    /api/admin/settings/{key}     # Update specific setting
```

### Audit Logs:
```python
GET    /api/admin/audit-logs         # List audit logs
GET    /api/admin/audit-logs/{id}    # Get log detail
```

---

## 📊 DATABASE SCHEMA

### Settings table:
```sql
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    category VARCHAR(50),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Audit logs table (đã có):
```sql
audit_logs (
    id, user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, created_at
)
```

---

## 🚀 TRIỂN KHAI

### Phase 1: User Management (2 giờ)
- Backend API
- Frontend UI
- CRUD operations

### Phase 2: Settings System (1 giờ)
- Settings table
- API endpoints
- UI cho organization, email, notifications

### Phase 3: Audit Logs (30 phút)
- UI để xem logs
- Filters và search

### Phase 4: Advanced Features (2 giờ)
- Role-based permissions
- API keys & webhooks
- Branding customization

---

**Bạn muốn tôi bắt đầu implement từ đâu?**
1. User Management (quan trọng nhất)
2. Settings System
3. Audit Logs
4. Tất cả cùng lúc (sẽ mất 4-5 giờ)
