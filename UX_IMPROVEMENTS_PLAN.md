# 🎨 KẾ HOẠCH CẢI THIỆN UX

## 📋 Yêu cầu từ user

### 1. Keywords Page ✅
**Hiện tại:**
- ✅ Thêm nhóm
- ✅ Xóa nhóm
- ✅ Thêm từ khóa
- ✅ Xóa từ khóa
- ✅ On/Off từ khóa

**Cần thêm:**
- [ ] **SỬA nhóm từ khóa** (tên, mô tả, priority)
- [ ] **SỬA từ khóa** (keyword, type)

---

### 2. Sources Page - Lịch Quét 📅
**Hiện tại:**
- Dropdown chọn tần suất
- Input fields cố định cho tất cả

**Cần cải thiện:**
- [ ] **Hằng ngày** → Hiện **checkbox giờ** (0-23h)
- [ ] **Hằng tuần** → Hiện **checkbox thứ** (T2-CN) + giờ
- [ ] **Hằng tháng** → Hiện **checkbox ngày** (1-31) + giờ
- [ ] **Hằng năm** → Hiện **checkbox tháng** (1-12) + ngày + giờ
- [ ] **Thủ công** → Ẩn tất cả options

---

### 3. Sources Page - Loại Nguồn 🌐
**Hiện tại:**
- Dropdown chọn loại
- Chỉ có ô nhập URL

**Cần cải thiện:**

#### **Website** → Ô nhập địa chỉ web
```
[Input] URL: https://example.com
```

#### **Facebook/TikTok/YouTube** → Form đăng nhập
```
[Input] Username/Email: _______
[Input] Password: _______
[Input] Page/Channel URL: _______
[Checkbox] Lưu credentials (encrypted)
```

#### **RSS** → Ô nhập RSS feed
```
[Input] RSS Feed URL: https://example.com/feed.xml
[Button] Validate Feed
```

#### **News** → Tương tự Website
```
[Input] News Site URL: _______
```

#### **Forum** → Form đặc biệt
```
[Input] Forum URL: _______
[Input] Username (optional): _______
[Input] Password (optional): _______
```

---

## 🎯 Ưu tiên triển khai

### Phase 1: Keywords Edit (Nhanh - 30 phút)
1. Thêm nút Edit cho nhóm
2. Thêm nút Edit cho từ khóa
3. Modal edit tương tự modal add
4. API đã có sẵn (updateGroup, updateKeyword)

### Phase 2: Sources - Dynamic Schedule UI (Trung bình - 1 giờ)
1. Component checkbox giờ (24 checkboxes)
2. Component checkbox thứ (7 checkboxes)
3. Component checkbox ngày (31 checkboxes)
4. Component checkbox tháng (12 checkboxes)
5. Logic show/hide theo frequency

### Phase 3: Sources - Dynamic Source Type UI (Phức tạp - 2 giờ)
1. Component cho mỗi loại source
2. Form đăng nhập social media
3. Validation RSS feed
4. Lưu credentials an toàn (backend cần encrypt)

---

## 🚀 Bắt đầu với Phase 1

Tôi sẽ làm Phase 1 trước (Keywords Edit) vì:
- ✅ Nhanh nhất
- ✅ API đã có
- ✅ Ít thay đổi backend
- ✅ User có thể dùng ngay

Sau đó làm Phase 2 và 3 nếu bạn muốn.

---

**Bạn muốn tôi làm theo thứ tự này không?**
Hoặc bạn muốn ưu tiên phần nào trước?
