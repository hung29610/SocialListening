# 📋 Service Request Workflow - Hướng Dẫn & Troubleshooting

## 🎯 Tổng Quan

Service Request Workflow cho phép tạo và quản lý các yêu cầu dịch vụ bảo vệ danh tiếng và xử lý khủng hoảng.

## ✅ Đã Hoàn Thành

### Backend
- ✅ 5 bảng database: `service_categories`, `services`, `service_requests`, `service_request_logs`, `service_deliverables`
- ✅ Đầy đủ API endpoints cho CRUD operations
- ✅ Workflow actions: submit, approve, reject, complete, cancel
- ✅ 7 categories và 5 services mẫu đã được seed

### Frontend
- ✅ Services page với 3 tabs: Overview, Catalog, Requests
- ✅ Dashboard summary với metrics
- ✅ Service detail modal
- ✅ **Service request creation form** (vừa tạo xong)
- ✅ Service catalog table với search
- ✅ Service requests table

## ⚠️ Vấn Đề Hiện Tại

### Backend API Errors (Production)

**Các endpoint bị lỗi:**
1. `POST /api/services/categories` - 500 Internal Server Error
2. `POST /api/services` - 500 Internal Server Error  
3. `GET /api/services/categories` - 500 Internal Server Error
4. `POST /api/services/requests` - 500 Internal Server Error
5. `GET /api/services/requests` - 422 Validation Error

**Các endpoint hoạt động:**
- ✅ `GET /api/services` - List services
- ✅ `GET /api/services/dashboard-summary` - Dashboard metrics
- ✅ `GET /api/admin/service-catalog-status` - Check tables

### Nguyên Nhân Có Thể

1. **Database Schema Issues:**
   - Enum types có thể không được tạo đúng trên production
   - Foreign key constraints có vấn đề
   - Column types không khớp với models

2. **Pydantic Serialization:**
   - ServiceCategoryResponse có thể có vấn đề với `updated_at` field
   - Enum serialization không đúng

3. **Migration Issues:**
   - Alembic migrations có thể chưa chạy đầy đủ
   - Manual SQL trong admin.py có thể conflict với Alembic

## 🔧 Cách Fix

### Bước 1: Kiểm Tra Logs trên Render

1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com/)
2. Chọn service `social-listening-backend`
3. Click tab **Logs**
4. Tìm các error messages khi call API endpoints
5. Chú ý các lỗi về:
   - `psycopg2.errors`
   - `pydantic.ValidationError`
   - `sqlalchemy.exc`

### Bước 2: Fix Database Schema

**Option 1: Chạy lại migrations**

```bash
# SSH vào Render hoặc dùng Render Shell
cd backend
alembic upgrade head
```

**Option 2: Chạy admin endpoints**

```python
import requests

BASE_URL = "https://social-listening-backend.onrender.com"
# Login và get token
token = "..."

headers = {"Authorization": f"Bearer {token}"}

# Run migrations
response = requests.post(f"{BASE_URL}/api/admin/run-migrations", headers=headers)
print(response.json())

# Seed services
response = requests.post(f"{BASE_URL}/api/admin/seed-services", headers=headers)
print(response.json())
```

### Bước 3: Fix Pydantic Models

Nếu lỗi là về serialization, sửa `backend/app/schemas/service.py`:

```python
class ServiceCategoryResponse(ServiceCategoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None  # Đảm bảo Optional

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
```

### Bước 4: Redeploy Backend

Sau khi fix code:

```bash
git add .
git commit -m "fix: service catalog API errors"
git push origin main
```

Render sẽ tự động redeploy.

## 🧪 Test Workflow

Sau khi backend đã fix, chạy script test:

```bash
python test_service_request_workflow.py
```

Script này sẽ test toàn bộ workflow:
1. ✅ Login
2. ✅ List services
3. ✅ Create service request
4. ✅ Submit for approval
5. ✅ Approve request
6. ✅ Update to in_progress
7. ✅ Add deliverable
8. ✅ Complete request
9. ✅ View logs
10. ✅ Check dashboard

## 📱 Test Frontend

1. Truy cập: https://social-listening-azure.vercel.app/dashboard/services
2. Click tab **"Danh Mục Dịch Vụ"**
3. Click icon **"+"** (Plus) trên một service
4. Điền form:
   - Mức độ ưu tiên: High
   - Lý do yêu cầu: "Cần xử lý khủng hoảng danh tiếng khẩn cấp"
   - Tóm tắt bằng chứng: "10+ mentions tiêu cực"
   - Kết quả mong muốn: "Đánh giá và đề xuất phương án"
5. Click **"Tạo yêu cầu"**
6. Kiểm tra tab **"Yêu Cầu Dịch Vụ"** để xem request vừa tạo

## 🔗 Tích Hợp với Mentions/Alerts/Incidents

### Bước Tiếp Theo (Sau khi backend fix)

1. **Thêm nút "Create Service Request" vào Mention Detail Page**
   - File: `frontend/src/app/dashboard/mentions/[id]/page.tsx`
   - Thêm button để tạo service request từ mention
   - Pre-fill evidence_summary với mention content

2. **Thêm nút vào Alerts Page**
   - File: `frontend/src/app/dashboard/alerts/page.tsx`
   - Cho phép tạo service request từ alert

3. **Thêm nút vào Incidents Page**
   - File: `frontend/src/app/dashboard/incidents/page.tsx`
   - Cho phép tạo service request từ incident

### Code Example

```typescript
// In mention detail page
const handleCreateServiceRequest = () => {
  // Navigate to services page with pre-filled data
  router.push(`/dashboard/services?mention_id=${mention.id}`);
  
  // Or open modal directly
  setShowServiceRequestModal(true);
  setRequestForm({
    ...requestForm,
    related_mention_id: mention.id,
    evidence_summary: mention.content,
    request_reason: `Xử lý mention tiêu cực: ${mention.source_url}`
  });
};
```

## 📊 Workflow States

### Service Request Status Flow

```
draft → submitted → approved → in_progress → completed
                  ↓
                rejected
                  
Any state → cancelled
```

### Approval Status

```
not_required (auto-approved services)
pending → approved
       → rejected
       → revision_required
```

### Priority Levels

- `low` - Thấp (xử lý trong 7 ngày)
- `medium` - Trung bình (xử lý trong 3 ngày)
- `high` - Cao (xử lý trong 24h)
- `urgent` - Khẩn cấp (xử lý ngay)

## 📝 Service Types

- `crisis_consulting` - Tư vấn khủng hoảng
- `monitoring` - Giám sát
- `legal_takedown` - Yêu cầu gỡ bỏ hợp pháp
- `press_media` - Xử lý báo chí
- `copyright_protection` - Bảo vệ bản quyền
- `community_response` - Phản hồi cộng đồng
- `reputation_management` - Quản trị danh tiếng
- `evidence_collection` - Thu thập bằng chứng
- `ai_reporting` - Báo cáo AI

## 🎨 Frontend Components Cần Tạo

### 1. Service Request Detail Page
- URL: `/dashboard/services/requests/[id]`
- Hiển thị chi tiết request
- Timeline của các actions
- Deliverables list
- Action buttons (approve, reject, complete, cancel)

### 2. Service Request Actions Component
- Approve modal với final price input
- Reject modal với reason
- Complete modal với result summary
- Cancel modal với reason

### 3. Integration Buttons
- Trong mention detail: "Create Service Request"
- Trong alert card: "Request Service"
- Trong incident detail: "Escalate to Service"

## 🚀 Deployment Checklist

- [ ] Fix backend API errors
- [ ] Test all endpoints với Postman/curl
- [ ] Run workflow test script
- [ ] Test frontend form
- [ ] Deploy frontend changes
- [ ] Test end-to-end workflow
- [ ] Add integration buttons
- [ ] Test integration với mentions/alerts/incidents
- [ ] Update documentation
- [ ] Train users

## 📞 Support

Nếu gặp vấn đề:
1. Check Render logs
2. Check browser console (F12)
3. Test API với curl/Postman
4. Check database với psql
5. Review error messages

## 🔐 Security Notes

- Tất cả service requests require authentication
- Approval workflow enforced cho high-risk services
- Audit logs tracked trong `service_request_logs`
- Compliance notices hiển thị trong UI
- Legal basis required cho mọi services

---

**Last Updated:** 2026-05-10
**Status:** Backend có issues, Frontend ready
**Next Steps:** Fix backend errors → Test workflow → Add integrations
