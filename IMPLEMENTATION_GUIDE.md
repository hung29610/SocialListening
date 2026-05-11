# 📘 HƯỚNG DẪN TRIỂN KHAI CẢI TIẾN UX

## 🎯 Tổng quan

Tài liệu này hướng dẫn chi tiết cách implement 3 cải tiến UX:
1. Keywords - Thêm chức năng SỬA
2. Sources - Lịch quét động (checkbox giờ/thứ/tháng/năm)
3. Sources - Form động theo loại nguồn

---

## 1️⃣ KEYWORDS - THÊM CHỨC NĂNG SỬA

### A. Thêm state cho edit

```typescript
// Thêm vào KeywordsPage component
const [showEditGroupModal, setShowEditGroupModal] = useState(false);
const [showEditKeywordModal, setShowEditKeywordModal] = useState(false);
const [editingGroup, setEditingGroup] = useState<KeywordGroup | null>(null);
const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
```

### B. Thêm handlers

```typescript
// Edit Group
const handleEditGroup = (group: KeywordGroup) => {
  setEditingGroup(group);
  setNewGroup({
    name: group.name,
    description: group.description || '',
    priority: group.priority
  });
  setShowEditGroupModal(true);
};

const handleUpdateGroup = async () => {
  if (!editingGroup || !newGroup.name.trim()) {
    toast.error('Vui lòng nhập tên nhóm');
    return;
  }

  try {
    await keywordsApi.updateGroup(editingGroup.id, {
      name: newGroup.name,
      description: newGroup.description || undefined,
      priority: newGroup.priority
    });
    
    setShowEditGroupModal(false);
    setEditingGroup(null);
    setNewGroup({ name: '', description: '', priority: 3 });
    toast.success('Cập nhật nhóm thành công!');
    fetchGroups();
  } catch (error: any) {
    console.error('Error updating group:', error);
    toast.error('Lỗi khi cập nhật nhóm');
  }
};

// Edit Keyword
const handleEditKeyword = (keyword: Keyword) => {
  setEditingKeyword(keyword);
  setNewKeyword({
    keyword: keyword.keyword,
    keyword_type: keyword.keyword_type
  });
  setShowEditKeywordModal(true);
};

const handleUpdateKeyword = async () => {
  if (!editingKeyword || !newKeyword.keyword.trim()) {
    toast.error('Vui lòng nhập từ khóa');
    return;
  }

  try {
    await keywordsApi.updateKeyword(editingKeyword.id, {
      keyword: newKeyword.keyword,
      keyword_type: newKeyword.keyword_type
    });
    
    setShowEditKeywordModal(false);
    setEditingKeyword(null);
    setNewKeyword({ keyword: '', keyword_type: 'general' });
    toast.success('Cập nhật từ khóa thành công!');
    
    await fetchKeywordsInGroup(editingKeyword.group_id);
    fetchGroups();
  } catch (error: any) {
    console.error('Error updating keyword:', error);
    toast.error('Lỗi khi cập nhật từ khóa');
  }
};
```

### C. Thêm nút Edit vào UI

**Trong group header:**
```tsx
<div className="flex items-center space-x-2">
  <button
    onClick={() => handleEditGroup(group)}
    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
    title="Sửa nhóm"
  >
    <Edit className="w-4 h-4" />
  </button>
  <button
    onClick={() => openAddKeywordModal(group.id)}
    className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
  >
    <Plus className="w-4 h-4 inline mr-1" />
    Thêm từ khóa
  </button>
  <button
    onClick={() => setDeleteGroupConfirm({ isOpen: true, groupId: group.id, groupName: group.name })}
    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    title="Xóa nhóm"
  >
    <Trash2 className="w-4 h-4" />
  </button>
</div>
```

**Trong keyword item:**
```tsx
<div className="flex items-center space-x-2">
  <button
    onClick={() => handleToggleKeywordActive(keyword)}
    className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
      keyword.is_active
        ? 'bg-green-100 text-green-800 hover:bg-green-200'
        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }`}
  >
    {keyword.is_active ? 'ON' : 'OFF'}
  </button>
  <button
    onClick={() => handleEditKeyword(keyword)}
    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
    title="Sửa"
  >
    <Edit className="w-4 h-4" />
  </button>
  <button
    onClick={() => setDeleteKeywordConfirm({ isOpen: true, keywordId: keyword.id, keyword: keyword.keyword, groupId: group.id })}
    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
  >
    <Trash2 className="w-4 h-4" />
  </button>
</div>
```

### D. Thêm Edit Modals

**Edit Group Modal** (tương tự Add Group Modal):
```tsx
{showEditGroupModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900">Sửa nhóm từ khóa</h2>
      </div>
      
      <div className="p-6 space-y-4">
        {/* Same fields as Add Group Modal */}
      </div>

      <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
        <button
          onClick={() => {
            setShowEditGroupModal(false);
            setEditingGroup(null);
          }}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Hủy
        </button>
        <button
          onClick={handleUpdateGroup}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Cập nhật
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 2️⃣ SOURCES - LỊCH QUÉT ĐỘNG

### A. Tạo component CheckboxGroup

```tsx
// File: frontend/src/components/CheckboxGroup.tsx
interface CheckboxGroupProps {
  label: string;
  options: { value: number | string; label: string }[];
  selected: (number | string)[];
  onChange: (selected: (number | string)[]) => void;
  columns?: number;
}

export default function CheckboxGroup({ label, options, selected, onChange, columns = 4 }: CheckboxGroupProps) {
  const toggleOption = (value: number | string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className={`grid grid-cols-${columns} gap-2`}>
        {options.map(option => (
          <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggleOption(option.value)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

### B. Sử dụng trong Sources Page

```tsx
// State
const [scheduleConfig, setScheduleConfig] = useState({
  hours: [] as number[],      // [0, 1, 2, ..., 23]
  daysOfWeek: [] as number[],  // [0=Monday, 1=Tuesday, ..., 6=Sunday]
  daysOfMonth: [] as number[], // [1, 2, 3, ..., 31]
  months: [] as number[]       // [1, 2, 3, ..., 12]
});

// Options
const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i}:00`
}));

const dayOfWeekOptions = [
  { value: 0, label: 'T2' },
  { value: 1, label: 'T3' },
  { value: 2, label: 'T4' },
  { value: 3, label: 'T5' },
  { value: 4, label: 'T6' },
  { value: 5, label: 'T7' },
  { value: 6, label: 'CN' }
];

const dayOfMonthOptions = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`
}));

const monthOptions = [
  { value: 1, label: 'T1' },
  { value: 2, label: 'T2' },
  { value: 3, label: 'T3' },
  { value: 4, label: 'T4' },
  { value: 5, label: 'T5' },
  { value: 6, label: 'T6' },
  { value: 7, label: 'T7' },
  { value: 8, label: 'T8' },
  { value: 9, label: 'T9' },
  { value: 10, label: 'T10' },
  { value: 11, label: 'T11' },
  { value: 12, label: 'T12' }
];

// Render based on frequency
{newSource.crawl_frequency === 'daily' && (
  <CheckboxGroup
    label="Chọn giờ quét"
    options={hourOptions}
    selected={scheduleConfig.hours}
    onChange={(hours) => setScheduleConfig({ ...scheduleConfig, hours: hours as number[] })}
    columns={6}
  />
)}

{newSource.crawl_frequency === 'weekly' && (
  <>
    <CheckboxGroup
      label="Chọn thứ"
      options={dayOfWeekOptions}
      selected={scheduleConfig.daysOfWeek}
      onChange={(days) => setScheduleConfig({ ...scheduleConfig, daysOfWeek: days as number[] })}
      columns={7}
    />
    <CheckboxGroup
      label="Chọn giờ"
      options={hourOptions}
      selected={scheduleConfig.hours}
      onChange={(hours) => setScheduleConfig({ ...scheduleConfig, hours: hours as number[] })}
      columns={6}
    />
  </>
)}

{newSource.crawl_frequency === 'monthly' && (
  <>
    <CheckboxGroup
      label="Chọn ngày trong tháng"
      options={dayOfMonthOptions}
      selected={scheduleConfig.daysOfMonth}
      onChange={(days) => setScheduleConfig({ ...scheduleConfig, daysOfMonth: days as number[] })}
      columns={7}
    />
    <CheckboxGroup
      label="Chọn giờ"
      options={hourOptions}
      selected={scheduleConfig.hours}
      onChange={(hours) => setScheduleConfig({ ...scheduleConfig, hours: hours as number[] })}
      columns={6}
    />
  </>
)}

{newSource.crawl_frequency === 'yearly' && (
  <>
    <CheckboxGroup
      label="Chọn tháng"
      options={monthOptions}
      selected={scheduleConfig.months}
      onChange={(months) => setScheduleConfig({ ...scheduleConfig, months: months as number[] })}
      columns={6}
    />
    <CheckboxGroup
      label="Chọn ngày"
      options={dayOfMonthOptions}
      selected={scheduleConfig.daysOfMonth}
      onChange={(days) => setScheduleConfig({ ...scheduleConfig, daysOfMonth: days as number[] })}
      columns={7}
    />
    <CheckboxGroup
      label="Chọn giờ"
      options={hourOptions}
      selected={scheduleConfig.hours}
      onChange={(hours) => setScheduleConfig({ ...scheduleConfig, hours: hours as number[] })}
      columns={6}
    />
  </>
)}
```

---

## 3️⃣ SOURCES - FORM ĐỘNG THEO LOẠI NGUỒN

### A. Tạo components cho từng loại

```tsx
// Component cho Website
const WebsiteForm = ({ url, onChange }: { url: string; onChange: (url: string) => void }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Địa chỉ website *
    </label>
    <input
      type="url"
      value={url}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="https://example.com"
    />
  </div>
);

// Component cho Social Media (FB, TikTok, YT)
const SocialMediaForm = ({ platform, credentials, onChange }: any) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Username/Email *
      </label>
      <input
        type="text"
        value={credentials.username}
        onChange={(e) => onChange({ ...credentials, username: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="username hoặc email"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Password *
      </label>
      <input
        type="password"
        value={credentials.password}
        onChange={(e) => onChange({ ...credentials, password: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="••••••••"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {platform === 'facebook' ? 'Page URL' : platform === 'youtube' ? 'Channel URL' : 'Profile URL'}
      </label>
      <input
        type="url"
        value={credentials.pageUrl}
        onChange={(e) => onChange({ ...credentials, pageUrl: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={`https://${platform}.com/...`}
      />
    </div>
    <div className="flex items-center">
      <input
        type="checkbox"
        checked={credentials.saveCredentials}
        onChange={(e) => onChange({ ...credentials, saveCredentials: e.target.checked })}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <label className="ml-2 text-sm text-gray-700">
        Lưu thông tin đăng nhập (mã hóa an toàn)
      </label>
    </div>
  </div>
);

// Component cho RSS
const RSSForm = ({ url, onChange, onValidate }: any) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        RSS Feed URL *
      </label>
      <input
        type="url"
        value={url}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="https://example.com/feed.xml"
      />
    </div>
    <button
      type="button"
      onClick={onValidate}
      className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
    >
      Kiểm tra Feed
    </button>
  </div>
);
```

### B. Render động trong Sources Page

```tsx
// State
const [sourceCredentials, setSourceCredentials] = useState({
  username: '',
  password: '',
  pageUrl: '',
  saveCredentials: false
});

// Render based on source_type
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Loại nguồn
  </label>
  <select
    value={newSource.source_type}
    onChange={(e) => {
      setNewSource({ ...newSource, source_type: e.target.value });
      // Reset credentials when changing type
      setSourceCredentials({ username: '', password: '', pageUrl: '', saveCredentials: false });
    }}
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="website">Website</option>
    <option value="facebook_page">Facebook Page</option>
    <option value="youtube_channel">YouTube Channel</option>
    <option value="tiktok">TikTok</option>
    <option value="rss">RSS Feed</option>
    <option value="news">News Site</option>
    <option value="forum">Forum</option>
  </select>
</div>

{/* Dynamic form based on source type */}
{newSource.source_type === 'website' && (
  <WebsiteForm
    url={newSource.url}
    onChange={(url) => setNewSource({ ...newSource, url })}
  />
)}

{['facebook_page', 'youtube_channel', 'tiktok'].includes(newSource.source_type) && (
  <SocialMediaForm
    platform={newSource.source_type.split('_')[0]}
    credentials={sourceCredentials}
    onChange={setSourceCredentials}
  />
)}

{newSource.source_type === 'rss' && (
  <RSSForm
    url={newSource.url}
    onChange={(url) => setNewSource({ ...newSource, url })}
    onValidate={() => {
      // TODO: Validate RSS feed
      toast.info('Đang kiểm tra RSS feed...');
    }}
  />
)}
```

---

## 🚀 TRIỂN KHAI

### Bước 1: Keywords Edit (30 phút)
1. Copy code từ section 1
2. Test thêm/sửa/xóa nhóm
3. Test thêm/sửa/xóa từ khóa

### Bước 2: Sources Schedule (1 giờ)
1. Tạo CheckboxGroup component
2. Thêm vào Sources page
3. Test với các tần suất khác nhau

### Bước 3: Sources Dynamic Forms (2 giờ)
1. Tạo các form components
2. Thêm logic render động
3. **Backend cần thêm:** Lưu credentials encrypted

---

## ⚠️ LƯU Ý

### Backend Changes Needed:
1. **Sources table** cần thêm columns:
   - `credentials` (JSON, encrypted)
   - `schedule_config` (JSON) - lưu hours/days/months arrays

2. **API endpoints** cần update:
   - Accept schedule_config trong create/update
   - Encrypt/decrypt credentials

3. **Crawler** cần update:
   - Đọc schedule_config
   - Sử dụng credentials để login social media

---

**Bạn muốn tôi implement code hoàn chỉnh cho phần nào trước?**
