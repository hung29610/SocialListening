# 📜 Scripts

## 🔍 Check & Test Scripts

### `check_backend_health.py`
Kiểm tra trạng thái backend API endpoints.
```bash
python scripts/check_backend_health.py
```

### `check_categories.py`
Xem categories và services hiện có trong database.
```bash
python scripts/check_categories.py
```

### `test_service_request_workflow.py`
Test toàn bộ workflow tạo và xử lý service request.
```bash
python scripts/test_service_request_workflow.py
```

## 📥 Import Scripts

### `import_excel_services_v2.py` (Recommended)
Import 26 services từ Excel vào database.
```bash
python scripts/import_excel_services_v2.py
```

### `import_excel_services.py` (Alternative)
Import với categories mới.
```bash
python scripts/import_excel_services.py
```

## 🔧 Utility Scripts

### `analyze_excel.py`
Phân tích cấu trúc file Excel.
```bash
python scripts/analyze_excel.py
```

### `excel_parser.py`
Parse Excel thành JSON.
```bash
python scripts/excel_parser.py
```

### `create_admin_remote.py`
Tạo admin user trên production.
```bash
python scripts/create_admin_remote.py
```

---

**Note:** Tất cả scripts đều kết nối đến production backend trên Render.
