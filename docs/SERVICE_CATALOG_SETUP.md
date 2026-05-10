# Service Catalog Module - Setup Guide

## Tổng quan

Service Catalog module cung cấp hệ thống quản lý dịch vụ bảo vệ danh tiếng và xử lý khủng hoảng với quy trình tuân thủ pháp luật.

## Tính năng chính

### 1. **Service Categories** (Danh mục dịch vụ)
- Crisis Consulting & Handling
- Negative Content Monitoring
- Legal Takedown & Correction Request
- Press/Media Handling
- Copyright & Brand Protection
- Community Response Planning
- Monthly Reputation Management

### 2. **Services** (Dịch vụ)
Mỗi dịch vụ bao gồm:
- Mã dịch vụ (code)
- Tên và mô tả
- Loại dịch vụ (service_type)
- Nền tảng áp dụng (platform)
- Cơ sở pháp lý (legal_basis)
- Quy trình làm việc (workflow_template)
- Sản phẩm bàn giao (deliverables)
- Thời gian ước tính và SLA
- Giá cơ bản
- Mức độ rủi ro
- Yêu cầu phê duyệt

### 3. **Service Requests** (Yêu cầu dịch vụ)
- Tạo yêu cầu dịch vụ
- Liên kết với mentions, alerts, incidents
- Quy trình phê duyệt
- Theo dõi tiến độ
- Quản lý deliverables

### 4. **Compliance & Legal Focus**
- Tất cả dịch vụ tuân thủ pháp luật
- Không hỗ trợ: hack, DDoS, spam, truy cập trái phép
- Tập trung vào: thu thập bằng chứng, soạn thảo phản hồi, yêu cầu gỡ bỏ hợp pháp

## Cấu trúc Database

### Tables
1. **service_categories** - Danh mục dịch vụ
2. **services** - Dịch vụ
3. **service_requests** - Yêu cầu dịch vụ
4. **service_request_logs** - Lịch sử thay đổi
5. **service_deliverables** - Sản phẩm bàn giao

### Enums
- ServiceType: crisis_consulting, monitoring, legal_takedown, press_media, etc.
- Platform: facebook, youtube, tiktok, twitter, instagram, website, news_media, all_platforms
- RiskLevel: low, medium, high, critical
- ServiceRequestStatus: draft, submitted, pending_approval, approved, in_progress, waiting_external_response, completed, rejected, cancelled
- ApprovalStatus: not_required, pending, approved, rejected, revision_required
- Priority: low, medium, high, urgent
- DeliverableType: report, draft_response, legal_document, evidence_package, strategy_plan, briefing, monitoring_dashboard

## Setup Instructions

### Bước 1: Deploy Backend
Code đã được push lên GitHub và Render sẽ tự động deploy.

### Bước 2: Chạy Migration
Sử dụng admin endpoint để tạo tables:

```bash
# Login để lấy token
curl -X POST "https://social-listening-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@sociallistening.com&password=Admin@123456"

# Chạy migration
curl -X POST "https://social-listening-backend.onrender.com/api/admin/run-migrations" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Hoặc sử dụng Python script:
```bash
python test_admin_endpoints.py
```

### Bước 3: Seed Data
Sau khi migration thành công, seed dữ liệu mẫu:

```bash
curl -X POST "https://social-listening-backend.onrender.com/api/admin/seed-services" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Bước 4: Kiểm tra Status
```bash
curl -X GET "https://social-listening-backend.onrender.com/api/admin/service-catalog-status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Bước 5: Deploy Frontend
Frontend đã được deploy tự động trên Vercel tại:
https://social-listening-azure.vercel.app

## API Endpoints

### Service Categories
- `GET /api/services/categories` - List categories
- `POST /api/services/categories` - Create category
- `GET /api/services/categories/{id}` - Get category
- `PUT /api/services/categories/{id}` - Update category
- `DELETE /api/services/categories/{id}` - Delete category

### Services
- `GET /api/services` - List services
- `POST /api/services` - Create service
- `GET /api/services/{id}` - Get service
- `PUT /api/services/{id}` - Update service
- `DELETE /api/services/{id}` - Delete service

### Service Requests
- `GET /api/services/requests` - List requests
- `POST /api/services/requests` - Create request
- `GET /api/services/requests/{id}` - Get request
- `PUT /api/services/requests/{id}` - Update request
- `POST /api/services/requests/{id}/submit` - Submit request
- `POST /api/services/requests/{id}/approve` - Approve request
- `POST /api/services/requests/{id}/reject` - Reject request
- `POST /api/services/requests/{id}/complete` - Complete request
- `POST /api/services/requests/{id}/cancel` - Cancel request

### Service Request Logs
- `GET /api/services/requests/{id}/logs` - Get logs
- `POST /api/services/requests/{id}/logs` - Create log

### Service Deliverables
- `GET /api/services/requests/{id}/deliverables` - Get deliverables
- `POST /api/services/requests/{id}/deliverables` - Create deliverable
- `PUT /api/services/deliverables/{id}` - Update deliverable

### Dashboard
- `GET /api/services/dashboard-summary` - Get dashboard summary

### Admin (Setup)
- `GET /api/admin/service-catalog-status` - Check status
- `POST /api/admin/run-migrations` - Run migrations
- `POST /api/admin/seed-services` - Seed data

## Frontend Pages

### Services Page (`/dashboard/services`)
3 tabs:
1. **Overview** - Dashboard với metrics
2. **Catalog** - Danh sách dịch vụ
3. **Requests** - Yêu cầu dịch vụ

### Features
- Tìm kiếm dịch vụ
- Xem chi tiết dịch vụ
- Tạo yêu cầu dịch vụ
- Theo dõi trạng thái yêu cầu
- Quản lý phê duyệt

## Sample Services

### 1. Crisis Situation Assessment (CRISIS_ASSESS)
- **Giá**: 5,000,000 VND
- **SLA**: 8 giờ
- **Mức rủi ro**: Medium
- **Yêu cầu phê duyệt**: Có

### 2. Crisis Response Plan (CRISIS_PLAN)
- **Giá**: 8,000,000 VND
- **SLA**: 48 giờ
- **Mức rủi ro**: High
- **Yêu cầu phê duyệt**: Có

### 3. Legal Takedown Request Draft (LEGAL_TAKEDOWN)
- **Giá**: 15,000,000 VND
- **SLA**: 48 giờ
- **Mức rủi ro**: High
- **Yêu cầu phê duyệt**: Có

### 4. Monthly Negative Mention Monitoring (MONTHLY_MONITOR)
- **Giá**: 12,000,000 VND/tháng
- **SLA**: 168 giờ (weekly reporting)
- **Mức rủi ro**: Low
- **Yêu cầu phê duyệt**: Không

### 5. Press Response Draft (PRESS_RESPONSE)
- **Giá**: 6,000,000 VND
- **SLA**: 12 giờ
- **Mức rủi ro**: High
- **Yêu cầu phê duyệt**: Có

## Compliance Notice

Tất cả quy trình dịch vụ trong hệ thống được thiết kế cho việc:
- ✅ Bảo vệ danh tiếng hợp pháp
- ✅ Thu thập bằng chứng
- ✅ Soạn thảo phản hồi chính thức
- ✅ Báo cáo chính sách nền tảng
- ✅ Chuẩn bị yêu cầu gỡ bỏ/sửa chữa hợp pháp

Hệ thống KHÔNG hỗ trợ:
- ❌ Hack
- ❌ DDoS
- ❌ Spam report
- ❌ Truy cập trái phép
- ❌ Chiếm đoạt tài khoản
- ❌ Scraping riêng tư
- ❌ Thao túng nền tảng

## Testing

### Test Admin Endpoints
```bash
python test_admin_endpoints.py
```

### Test Services API
```bash
# Login
TOKEN=$(curl -X POST "https://social-listening-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@sociallistening.com&password=Admin@123456" | jq -r '.access_token')

# List services
curl -X GET "https://social-listening-backend.onrender.com/api/services" \
  -H "Authorization: Bearer $TOKEN"

# Get dashboard summary
curl -X GET "https://social-listening-backend.onrender.com/api/services/dashboard-summary" \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Migration fails
- Kiểm tra database connection
- Kiểm tra xem tables đã tồn tại chưa
- Xem logs trong Render dashboard

### Seed data fails
- Đảm bảo migration đã chạy thành công
- Kiểm tra xem data đã tồn tại chưa
- Xem logs để biết lỗi cụ thể

### Frontend build fails
- Kiểm tra TypeScript interfaces
- Đảm bảo tất cả properties đều được định nghĩa
- Xem build logs trong Vercel

## Next Steps

1. ✅ Deploy backend với Service Catalog module
2. ✅ Chạy migration để tạo tables
3. ✅ Seed dữ liệu mẫu
4. ✅ Deploy frontend với Services page
5. ⏳ Test tất cả API endpoints
6. ⏳ Test frontend UI
7. ⏳ Tạo service requests mẫu
8. ⏳ Test workflow phê duyệt

## Support

Nếu gặp vấn đề, kiểm tra:
1. Backend logs: https://dashboard.render.com
2. Frontend logs: https://vercel.com/dashboard
3. Database: Render PostgreSQL dashboard
4. API docs: https://social-listening-backend.onrender.com/docs