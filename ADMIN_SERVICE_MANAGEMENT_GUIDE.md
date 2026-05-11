# 📘 HƯỚNG DẪN QUẢN LÝ DỊCH VỤ CHO ADMIN

## 🎯 Tổng quan

Là Admin, bạn có thể:
- ✅ Xem tất cả yêu cầu dịch vụ
- ✅ Phê duyệt/Từ chối yêu cầu
- ✅ Theo dõi tiến độ
- ✅ Hoàn thành yêu cầu
- ✅ Quản lý toàn bộ workflow

---

## 📋 Quy trình xử lý yêu cầu dịch vụ

### 1. Xem danh sách yêu cầu

**Bước 1:** Vào trang Dịch vụ
```
Dashboard → Dịch vụ → Tab "Yêu Cầu Dịch Vụ"
```

**Bước 2:** Xem danh sách
- Tất cả yêu cầu hiển thị trong bảng
- Có các cột:
  - ID
  - Dịch vụ
  - Trạng thái
  - Ưu tiên
  - Phê duyệt
  - Giá
  - Tạo lúc
  - **Hành động** (icon mắt 👁️)

### 2. Xem chi tiết yêu cầu

**Click vào icon mắt (👁️) ở cột "Hành động"**

Modal chi tiết sẽ hiển thị:

#### A. Tổng quan trạng thái
- **Trạng thái**: draft, submitted, approved, in_progress, completed, etc.
- **Ưu tiên**: low, medium, high, urgent
- **Phê duyệt**: pending, approved, rejected, not_required

#### B. Thông tin dịch vụ
- Tên dịch vụ
- Danh mục
- Nền tảng

#### C. Chi tiết yêu cầu
- **Lý do yêu cầu**: Tại sao cần dịch vụ này
- **Tóm tắt bằng chứng**: Bằng chứng/tình huống
- **Kết quả mong muốn**: Mục tiêu cần đạt được
- **Kết quả thực tế**: (Hiển thị sau khi hoàn thành)

#### D. Giá cả
- **Giá báo**: Giá ước tính ban đầu
- **Giá cuối cùng**: Giá thực tế (sau phê duyệt)

#### E. Thời gian
- **Tạo lúc**: Thời điểm tạo yêu cầu
- **Deadline**: Hạn hoàn thành

---

## 🔄 Workflow xử lý

### Trạng thái 1: PENDING APPROVAL (Chờ phê duyệt)

**Khi nào:** Yêu cầu mới được tạo và dịch vụ yêu cầu phê duyệt

**Actions có thể thực hiện:**

#### ✅ Phê duyệt
1. Click nút **"Phê duyệt"** (màu xanh lá)
2. Yêu cầu chuyển sang trạng thái **APPROVED**
3. Sẵn sàng để bắt đầu xử lý

#### ❌ Từ chối
1. Click nút **"Từ chối"** (màu đỏ)
2. Nhập lý do từ chối
3. Yêu cầu chuyển sang trạng thái **REJECTED**

---

### Trạng thái 2: APPROVED (Đã phê duyệt)

**Khi nào:** Yêu cầu đã được phê duyệt, chờ bắt đầu xử lý

**Actions có thể thực hiện:**

#### 🚀 Bắt đầu xử lý
1. Click nút **"Bắt đầu xử lý"** (màu indigo)
2. Yêu cầu chuyển sang trạng thái **IN_PROGRESS**
3. Bắt đầu thực hiện dịch vụ

---

### Trạng thái 3: IN_PROGRESS (Đang xử lý)

**Khi nào:** Đang thực hiện dịch vụ

**Actions có thể thực hiện:**

#### ✅ Hoàn thành
1. Click nút **"Hoàn thành"** (màu xanh dương)
2. Nhập **tóm tắt kết quả**
3. Yêu cầu chuyển sang trạng thái **COMPLETED**

**Lưu ý:** Nếu đang chờ phản hồi từ bên ngoài (platform, cơ quan), có thể chuyển sang trạng thái **WAITING_EXTERNAL_RESPONSE**

---

### Trạng thái 4: COMPLETED (Hoàn thành)

**Khi nào:** Dịch vụ đã hoàn thành

**Actions:** Không có action nào (trạng thái cuối)

---

## 🎨 Màu sắc trạng thái

### Trạng thái yêu cầu
- 🟦 **draft** - Nháp (xám)
- 🟦 **submitted** - Đã gửi (xanh dương)
- 🟨 **pending_approval** - Chờ phê duyệt (vàng)
- 🟩 **approved** - Đã phê duyệt (xanh lá)
- 🟪 **in_progress** - Đang xử lý (tím)
- 🟧 **waiting_external_response** - Chờ phản hồi (cam)
- 🟩 **completed** - Hoàn thành (xanh lá)
- 🟥 **rejected** - Từ chối (đỏ)
- ⬜ **cancelled** - Hủy (xám)

### Ưu tiên
- 🟢 **low** - Thấp (xanh lá)
- 🟡 **medium** - Trung bình (vàng)
- 🟠 **high** - Cao (cam)
- 🔴 **urgent** - Khẩn cấp (đỏ)

### Phê duyệt
- ⬜ **not_required** - Không cần (xám)
- 🟡 **pending** - Chờ (vàng)
- 🟢 **approved** - Đã duyệt (xanh lá)
- 🔴 **rejected** - Từ chối (đỏ)
- 🟠 **revision_required** - Cần sửa (cam)

---

## 📊 Dashboard Summary

Ở tab **"Tổng Quan"**, bạn thấy:

### 6 Cards thống kê
1. **Dịch vụ hoạt động** - Tổng số dịch vụ có sẵn
2. **Yêu cầu đang mở** - Số yêu cầu chưa hoàn thành
3. **Chờ phê duyệt** - Số yêu cầu cần bạn phê duyệt
4. **Đã hoàn thành** - Số yêu cầu đã xong
5. **Rủi ro cao** - Số yêu cầu ưu tiên cao/khẩn cấp
6. **Chi phí tháng này** - Tổng chi phí tháng hiện tại

---

## 💡 Tips cho Admin

### 1. Ưu tiên xử lý
- Xử lý yêu cầu **URGENT** trước
- Sau đó đến **HIGH**
- Cuối cùng là **MEDIUM** và **LOW**

### 2. Kiểm tra thông tin
Trước khi phê duyệt, đọc kỹ:
- ✅ Lý do yêu cầu có hợp lý không?
- ✅ Bằng chứng có đầy đủ không?
- ✅ Kết quả mong muốn có rõ ràng không?
- ✅ Giá có phù hợp không?

### 3. Ghi chú kết quả
Khi hoàn thành, ghi rõ:
- ✅ Đã làm gì
- ✅ Kết quả như thế nào
- ✅ Có vấn đề gì không
- ✅ Khuyến nghị tiếp theo (nếu có)

### 4. Từ chối đúng cách
Khi từ chối, ghi rõ lý do:
- ❌ Thiếu thông tin
- ❌ Không đủ bằng chứng
- ❌ Không phù hợp với chính sách
- ❌ Cần bổ sung tài liệu

---

## 🔍 Ví dụ thực tế

### Ví dụ 1: Phê duyệt yêu cầu báo cáo khủng hoảng

**Tình huống:**
- User tạo yêu cầu "Báo cáo nhanh cho lãnh đạo"
- Lý do: "Phát hiện tin giả về sản phẩm trên Facebook"
- Bằng chứng: "Link bài viết + screenshot"
- Kết quả mong muốn: "Báo cáo tình hình và đề xuất giải pháp trong 2h"

**Xử lý:**
1. Click icon mắt → Xem chi tiết
2. Kiểm tra thông tin → OK
3. Click **"Phê duyệt"**
4. Click **"Bắt đầu xử lý"**
5. Thực hiện dịch vụ (phân tích, viết báo cáo)
6. Click **"Hoàn thành"**
7. Nhập kết quả: "Đã phân tích 50 bình luận, phát hiện 3 tài khoản spam chính. Đề xuất: 1) Báo cáo Facebook, 2) Đăng bài làm rõ, 3) Giám sát 24h"

### Ví dụ 2: Từ chối yêu cầu thiếu thông tin

**Tình huống:**
- User tạo yêu cầu "Gỡ bỏ nội dung vi phạm"
- Lý do: "Có người nói xấu"
- Bằng chứng: (trống)
- Kết quả mong muốn: "Xóa bài"

**Xử lý:**
1. Click icon mắt → Xem chi tiết
2. Kiểm tra → Thiếu bằng chứng cụ thể
3. Click **"Từ chối"**
4. Nhập lý do: "Vui lòng bổ sung: 1) Link bài viết cụ thể, 2) Screenshot nội dung vi phạm, 3) Giải thích rõ vi phạm điều khoản nào của nền tảng"

---

## ⚠️ Lưu ý quan trọng

### 1. Tuân thủ pháp luật
- ✅ Chỉ xử lý yêu cầu hợp pháp
- ✅ Không hỗ trợ hack, DDoS, spam
- ✅ Không thao túng nền tảng

### 2. Bảo mật thông tin
- 🔒 Thông tin yêu cầu là bí mật
- 🔒 Không chia sẻ ra ngoài
- 🔒 Lưu trữ bằng chứng an toàn

### 3. Chất lượng dịch vụ
- ⏰ Tuân thủ SLA (thời gian cam kết)
- 📊 Đảm bảo chất lượng đầu ra
- 💬 Giao tiếp rõ ràng với user

---

## 🆘 Troubleshooting

### Không thấy nút "Phê duyệt"?
→ Kiểm tra trạng thái phê duyệt có phải **pending** không

### Không thấy nút "Hoàn thành"?
→ Kiểm tra trạng thái có phải **in_progress** hoặc **waiting_external_response** không

### Không thấy yêu cầu nào?
→ Chưa có user nào tạo yêu cầu. Tạo test request để thử

### Lỗi khi phê duyệt?
→ Kiểm tra backend logs, có thể do database issue

---

## 📞 Liên hệ hỗ trợ

Nếu gặp vấn đề kỹ thuật:
1. Kiểm tra browser console (F12)
2. Kiểm tra backend logs trên Render
3. Chạy test script: `python scripts/test_services_comprehensive.py`

---

**Cập nhật:** 11/05/2026  
**Version:** 1.0  
**Status:** ✅ Hoạt động đầy đủ
