# 📥 Import Services từ Excel - Hướng Dẫn

## 📊 Dữ Liệu Excel

File: `data/mhc_bao_gia_khung_xlkh.xlsx`
- **Sheet 1:** "XLKH các TH đặc biệt khác" - 15 services
- **Sheet 2:** "Bảo vệ bản quyền thương hiệu" - 11 services
- **Tổng:** 26 services

Đã parse thành: `data/mhc_parsed_detailed.json`

## 🔧 Scripts Sẵn Sàng

### 1. `import_excel_services.py` (Original)
- Tạo categories mới từ Excel
- Import tất cả 26 services
- **Vấn đề:** Backend API `/api/services/categories` bị lỗi 500

### 2. `import_excel_services_v2.py` (Workaround)
- Map Excel categories sang existing categories
- Không tạo categories mới
- **Vấn đề:** Backend API `/api/services` (POST) bị lỗi 500

## ⚠️ Vấn Đề Hiện Tại

Backend production đang có lỗi 500 khi:
- Tạo categories mới
- Tạo services mới

**Cần fix backend trước khi import!**

## ✅ Sau Khi Backend Fix

### Option 1: Import với Categories Mới

```bash
python import_excel_services.py
```

Script này sẽ:
1. Login vào backend
2. Tạo 7 categories từ Excel:
   - I. Account cá nhân
   - II. Fanpage/ Group
   - III. Youtube, Tiktok
   - III. Website
   - XỬ LÝ QUAN HỆ BÁO CHÍ
   - QUẢN TRỊ DANH TIẾNG & ĐỊNH HƯỚNG CỘNG ĐỒNG
   - BẢO VỆ BẢN QUYỀN THƯƠNG HIỆU
3. Import 26 services vào các categories tương ứng

### Option 2: Import với Existing Categories

```bash
python import_excel_services_v2.py
```

Script này sẽ:
1. Login vào backend
2. Map Excel categories sang existing categories:
   - "I. Account cá nhân" → "Legal Takedown & Correction Request"
   - "II. Fanpage/ Group" → "Legal Takedown & Correction Request"
   - "III. Youtube, Tiktok" → "Legal Takedown & Correction Request"
   - "III. Website" → "Legal Takedown & Correction Request"
   - "XỬ LÝ QUAN HỆ BÁO CHÍ" → "Press/Media Handling"
   - "QUẢN TRỊ DANH TIẾNG..." → "Community Response Planning"
   - "BẢO VỆ BẢN QUYỀN..." → "Copyright & Brand Protection"
3. Import 26 services

**Lưu ý:** Option 2 cần thêm 2 categories:
- Community Response Planning
- Copyright & Brand Protection

## 📋 Service Mapping

### Từ Excel → Database

Mỗi service từ Excel sẽ được convert thành:

```python
{
    "category_id": <mapped_category_id>,
    "code": "EXCEL_<CATEGORY>_<INDEX>",
    "name": "<Tên dịch vụ từ Excel>",
    "description": "<Chi tiết công việc>",
    "service_type": "<mapped_type>",  # legal_takedown, press_media, etc.
    "platform": "<mapped_platform>",  # facebook, youtube, website, etc.
    "legal_basis": "Dịch vụ bảo vệ danh tiếng và xử lý khủng hoảng hợp pháp",
    "workflow_template": {
        "steps": [
            "Tiếp nhận yêu cầu",
            "Phân tích tình huống",
            "Thực hiện dịch vụ",
            "Báo cáo kết quả"
        ]
    },
    "deliverables": {
        "items": [
            "Báo cáo chi tiết",
            "Bằng chứng thực hiện"
        ]
    },
    "estimated_duration": "<Thời gian dự tính>",
    "sla_hours": 48,
    "base_price": <parsed_price>,  # Average nếu là range
    "min_quantity": 1,
    "unit": "<Đơn vị>",
    "risk_level": "<low/medium/high>",  # Based on price
    "requires_approval": true,
    "is_active": true
}
```

### Price Parsing

Excel có 4 loại giá:
1. **Fixed:** `30.000.000` → `30000000`
2. **Range:** `15.000.000 - 25.000.000` → `20000000` (average)
3. **Negotiable:** `Thỏa thuận` → `null`
4. **Free:** `Tặng kèm` → `0`

### Risk Level Determination

- `price >= 20M VND` → `high`
- `price >= 10M VND` → `medium`
- `price < 10M VND` → `low`
- `price = 0 or null` → `low`

## 🧪 Test Import

### Kiểm Tra Trước Khi Import

```bash
python check_categories.py
```

Xem có bao nhiêu categories và services hiện có.

### Chạy Import

```bash
# Option 1: Với categories mới
python import_excel_services.py

# Option 2: Với existing categories
python import_excel_services_v2.py
```

### Kiểm Tra Sau Import

```bash
python check_categories.py
```

Nên thấy:
- Categories: 7-14 (tùy option)
- Services: 31 (5 existing + 26 from Excel)

## 📊 Expected Results

### Services từ Sheet 1 (15 services)

**I. Account cá nhân (1 service):**
- Report tài khoản đã verify, tài khoản có tick xanh...
  - Giá: 15M-25M VND
  - Thời gian: 1-30 ngày

**II. Fanpage/ Group (2 services):**
- Gỡ post đăng trên Group kín (17M-18M VND, 24-48h)
- Report Group/Fanpage (15M-25M VND, 15-45 ngày)

**III. Youtube, Tiktok (4 services):**
- Video trên kênh Youtube (>35M VND, 2-15 ngày)
- Video trên kênh Tiktok (>25M VND, 2-15 ngày)
- Kênh Youtube (>16M VND, 2-15 ngày)
- Kênh Tiktok (>20M VND, 2-15 ngày)

**III. Website (2 services):**
- Gỡ bài bằng phương án kỹ thuật (25M-45M VND, 20-45 ngày)
- Xóa Index Google (25M-45M VND, 30-50 ngày)

**XỬ LÝ QUAN HỆ BÁO CHÍ (3 services):**
- Quan hệ BC - Gỡ bỏ thông tin xấu (Thỏa thuận, 1-5 ngày)
- Quan hệ BC - Edit nội dung bài (7M-35M VND, 1-5 ngày)
- Quan hệ BC - Gỡ bài khỏi hệ thống (5M-10M VND, 1-3h)

**QUẢN TRỊ DANH TIẾNG (3 services):**
- Quản trị tiêu cực (60M VND/tháng)
- Seeding Facebook (3M VND/150 comments)
- Seeding Forum/YouTube/TikTok (3M VND/100 comments)

### Services từ Sheet 2 (11 services)

**BẢO VỆ BẢN QUYỀN THƯƠNG HIỆU:**
- Bảo vệ video thương hiệu - Thiết lập (30M VND)
- Bảo vệ video - Thu thập (180M VND/tháng)
- Bảo vệ hình ảnh - Thiết lập (Tặng kèm)
- Bảo vệ hình ảnh - Thu thập (Tặng kèm)
- Gỡ post Facebook (18M VND)
- Report nguồn tiêu cực Facebook (20M VND)
- Định hướng cộng đồng - Seeding (Tặng kèm)
- Phụ lục - Thêm 10 video (5M VND/tháng)

## 🔍 Troubleshooting

### Lỗi: "Failed to create category: 500"
- Backend API có vấn đề
- Check Render logs
- Có thể cần chạy migrations

### Lỗi: "Failed to create service: 500"
- Backend API có vấn đề
- Check enum types trong database
- Check Pydantic models

### Lỗi: "No matching category found"
- Cần tạo thêm categories
- Hoặc update mapping trong script

### Services bị duplicate
- Script tự động check code trước khi tạo
- Nếu code đã tồn tại, sẽ skip

## 📝 Manual Import (Nếu Script Fail)

Nếu scripts không hoạt động, có thể import manual qua SQL:

```sql
-- Insert category
INSERT INTO service_categories (name, description, is_active)
VALUES ('Category Name', 'Description', true);

-- Insert service
INSERT INTO services (
    category_id, code, name, description, service_type, platform,
    legal_basis, workflow_template, deliverables, estimated_duration,
    sla_hours, base_price, min_quantity, unit, risk_level,
    requires_approval, is_active
) VALUES (
    1, 'SERVICE_CODE', 'Service Name', 'Description',
    'legal_takedown', 'facebook', 'Legal basis',
    '{"steps": ["Step 1"]}', '{"items": ["Item 1"]}',
    '1-2 days', 48, 15000000, 1, 'service', 'medium', true, true
);
```

## ✅ Verification

Sau khi import, verify bằng cách:

1. **Check database:**
```bash
python check_categories.py
```

2. **Check frontend:**
- Truy cập: https://social-listening-azure.vercel.app/dashboard/services
- Tab "Danh Mục Dịch Vụ"
- Nên thấy 31 services

3. **Check API:**
```bash
curl -H "Authorization: Bearer <token>" \
  https://social-listening-backend.onrender.com/api/services
```

## 🎯 Next Steps

Sau khi import thành công:
1. ✅ Review tất cả services trong frontend
2. ✅ Test tạo service request cho mỗi loại service
3. ✅ Adjust prices nếu cần
4. ✅ Update descriptions cho rõ ràng hơn
5. ✅ Add more workflow steps nếu cần
6. ✅ Configure SLA hours phù hợp
7. ✅ Set risk levels chính xác

---

**Status:** Chờ backend fix để import
**Scripts Ready:** ✅ import_excel_services.py, import_excel_services_v2.py
**Data Ready:** ✅ data/mhc_parsed_detailed.json
