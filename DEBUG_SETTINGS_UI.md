# 🐛 DEBUG SETTINGS UI - HƯỚNG DẪN

## ✅ BACKEND ĐÃ HOẠT ĐỘNG

Tôi đã test backend APIs và **TẤT CẢ ĐANG HOẠT ĐỘNG**:
- ✅ GET /api/auth/me/notification-settings → 200 OK
- ✅ PUT /api/auth/me/notification-settings → 200 OK
- ✅ GET /api/auth/me/preferences → 200 OK
- ✅ PUT /api/auth/me/preferences → 200 OK

**Vấn đề là ở FRONTEND** - UI không gọi API hoặc có lỗi JavaScript.

---

## 🔍 CÁCH DEBUG

### Bước 1: Mở Browser Console

1. Vào https://social-listening-azure.vercel.app
2. Login với tài khoản của bạn
3. Nhấn **F12** hoặc **Ctrl+Shift+I** để mở Developer Tools
4. Chọn tab **Console**

### Bước 2: Vào Settings Page

1. Click vào **Settings** (Cài đặt)
2. Click vào tab **Thông báo** hoặc **Giao diện**

### Bước 3: Test Toggle

1. Click vào một toggle switch (ví dụ: Email notifications)
2. Xem console, bạn sẽ thấy:
   ```
   🔵 [PersonalNotifications] Toggle emailNotifications: true
   ```

**Nếu KHÔNG thấy log này** → JavaScript bị lỗi hoặc component không render

### Bước 4: Test Save Button

1. Click nút **"Lưu cài đặt"**
2. Xem console, bạn sẽ thấy:
   ```
   🔵 [PersonalNotifications] handleSave called
   🔵 [PersonalNotifications] Current settings: {...}
   🔵 [PersonalNotifications] Token: exists
   🔵 [PersonalNotifications] Payload: {...}
   🔵 [PersonalNotifications] Response status: 200
   ✅ [PersonalNotifications] Success: {...}
   🔵 [PersonalNotifications] handleSave finished
   ```

**Nếu KHÔNG thấy log này** → onClick handler không được gọi

### Bước 5: Check Network Tab

1. Chọn tab **Network** trong Developer Tools
2. Click nút **"Lưu cài đặt"**
3. Tìm request đến `/api/auth/me/notification-settings`
4. Click vào request đó để xem:
   - **Request Headers**: Có Authorization token không?
   - **Request Payload**: Data có đúng không?
   - **Response**: Status code và response body

---

## 🚨 CÁC LỖI THƯỜNG GẶP

### Lỗi 1: Token Expired (401 Unauthorized)

**Triệu chứng**:
- Console log: `Response status: 401`
- Toast error: "Unauthorized"

**Giải pháp**:
1. Logout
2. Login lại
3. Thử lại

### Lỗi 2: CORS Error

**Triệu chứng**:
- Console error: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`
- Network tab: Request màu đỏ

**Giải pháp**:
- Backend đã config CORS cho Vercel domain
- Nếu vẫn lỗi, check backend logs

### Lỗi 3: Network Error

**Triệu chứng**:
- Console error: `Failed to fetch`
- Network tab: Request failed

**Giải pháp**:
- Check internet connection
- Check backend có đang chạy không: https://social-listening-backend.onrender.com/health

### Lỗi 4: JavaScript Error

**Triệu chứng**:
- Console error: `TypeError: ...` hoặc `ReferenceError: ...`
- Component không render

**Giải pháp**:
- Copy full error message
- Gửi cho tôi để fix

### Lỗi 5: onClick Handler Không Chạy

**Triệu chứng**:
- Click button nhưng không có log nào
- Không có network request

**Nguyên nhân có thể**:
- Button bị disabled
- Event handler bị override
- Component bị unmount

**Giải pháp**:
- Check trong Elements tab xem button có attribute `disabled` không
- Check console có error không

---

## 📋 CHECKLIST DEBUG

Khi bạn test, hãy check từng bước:

### Tab "Thông báo cá nhân"

- [ ] Component render (thấy UI)
- [ ] Loading spinner hiện rồi mất
- [ ] 5 toggles hiển thị
- [ ] Click toggle → Console log `🔵 Toggle ...`
- [ ] Toggle chuyển màu xanh/xám
- [ ] Click "Lưu cài đặt" → Console log `🔵 handleSave called`
- [ ] Network request xuất hiện
- [ ] Response status 200
- [ ] Toast success hiện "✅ Đã lưu cài đặt thông báo"
- [ ] Refresh page → Settings vẫn giữ nguyên

### Tab "Giao diện"

- [ ] Component render (thấy UI)
- [ ] Loading spinner hiện rồi mất
- [ ] 3 theme buttons hiển thị
- [ ] Click theme button → Console log `🔵 Theme changed to: ...`
- [ ] Button border chuyển màu xanh
- [ ] Click "Lưu cài đặt" → Console log `🔵 handleSave called`
- [ ] Network request xuất hiện
- [ ] Response status 200
- [ ] Toast success hiện "✅ Đã lưu cài đặt giao diện"
- [ ] Theme thay đổi UI (dark/light)
- [ ] Refresh page → Settings vẫn giữ nguyên

### Tab "Phiên đăng nhập"

- [ ] Component render
- [ ] Thấy warning box màu vàng "⚠️ Chưa tích hợp"
- [ ] Button "Đăng xuất tất cả" bị disabled (màu xám, cursor not-allowed)
- [ ] Không có console error

---

## 🎯 KẾT QUẢ MONG ĐỢI

Sau khi Vercel deploy xong (~2 phút), bạn sẽ thấy:

1. **Click toggle** → Console log xuất hiện
2. **Click "Lưu cài đặt"** → Console log xuất hiện
3. **Network request** → Status 200
4. **Toast notification** → "✅ Đã lưu..."
5. **Refresh page** → Settings vẫn giữ nguyên

**Nếu TẤT CẢ đều OK** → Tính năng đang hoạt động!

**Nếu có bước nào FAIL** → Copy console logs và gửi cho tôi

---

## 📸 CÁCH GỬI DEBUG INFO

Nếu vẫn không hoạt động, hãy gửi cho tôi:

1. **Screenshot Console tab** (toàn bộ logs)
2. **Screenshot Network tab** (request/response)
3. **Mô tả**: Bạn click vào đâu, điều gì xảy ra (hoặc không xảy ra)

Tôi sẽ fix triệt để!

---

## ⏰ TIMELINE

- **Bây giờ**: Vercel đang deploy frontend với debug logging
- **~2 phút**: Deploy xong
- **Sau đó**: Bạn test theo hướng dẫn trên
- **Nếu OK**: Tính năng hoạt động! 🎉
- **Nếu FAIL**: Gửi debug info cho tôi

---

**Lưu ý**: Backend APIs đã được verify hoạt động 100%. Vấn đề chỉ có thể là:
- Token expired
- CORS error
- JavaScript error
- Network error

Tất cả đều có thể fix được!
