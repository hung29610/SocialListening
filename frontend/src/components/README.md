# Components

## ConfirmDialog

Component modal xác nhận đẹp thay thế cho `window.confirm()` mặc định của browser.

### Features
- ✅ UI đẹp với animation
- ✅ 3 loại: danger (đỏ), warning (vàng), info (xanh)
- ✅ Icon cảnh báo
- ✅ Backdrop có thể click để đóng
- ✅ Nút X để đóng
- ✅ Responsive

### Usage

```tsx
import ConfirmDialog from '@/components/ConfirmDialog';

// State
const [deleteConfirm, setDeleteConfirm] = useState({
  isOpen: false,
  itemId: null,
  itemName: ''
});

// Handler
const handleDelete = async () => {
  if (!deleteConfirm.itemId) return;
  // Xử lý xóa
  await api.delete(deleteConfirm.itemId);
};

// JSX
<ConfirmDialog
  isOpen={deleteConfirm.isOpen}
  onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, itemName: '' })}
  onConfirm={handleDelete}
  title="Xóa item"
  message={`Bạn có chắc muốn xóa "${deleteConfirm.itemName}"?`}
  confirmText="Xóa"
  cancelText="Hủy"
  type="danger"
/>

// Trigger
<button onClick={() => setDeleteConfirm({ isOpen: true, itemId: item.id, itemName: item.name })}>
  Xóa
</button>
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| isOpen | boolean | ✅ | - | Hiển thị/ẩn dialog |
| onClose | () => void | ✅ | - | Callback khi đóng dialog |
| onConfirm | () => void | ✅ | - | Callback khi xác nhận |
| title | string | ✅ | - | Tiêu đề dialog |
| message | string | ✅ | - | Nội dung thông báo |
| confirmText | string | ❌ | 'Xác nhận' | Text nút xác nhận |
| cancelText | string | ❌ | 'Hủy' | Text nút hủy |
| type | 'danger' \| 'warning' \| 'info' | ❌ | 'warning' | Loại dialog (màu sắc) |

### Types

- **danger** (đỏ): Dùng cho các hành động nguy hiểm như xóa
- **warning** (vàng): Dùng cho các cảnh báo
- **info** (xanh): Dùng cho thông tin

## LoadingSpinner

Component loading spinner đẹp với animation.

### Usage

```tsx
import LoadingSpinner from '@/components/LoadingSpinner';

{loading && <LoadingSpinner />}
```
