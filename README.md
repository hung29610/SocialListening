# Social Listening Platform - MVP

Full-stack Social Listening Platform với FastAPI backend và Next.js frontend.

## 🚀 Features

### ✅ Đã Hoàn Thành
- **Authentication**: Đăng ký, đăng nhập, logout
- **Dashboard**: Metrics thời gian thực (mentions, alerts, incidents, sources)
- **Keywords Management**: Quản lý nhóm từ khóa và từ khóa
- **Sources Management**: Quản lý nguồn dữ liệu (Website, RSS, Social Media)
- **Scan Center**: Quét thủ công nguồn dữ liệu
  - Chọn nhóm từ khóa
  - Chọn nguồn có sẵn HOẶC nhập URL tùy chỉnh
  - Hỗ trợ: Website, RSS Feed, Blog
- **AI Analysis** (Dummy AI):
  - Phân tích sentiment (positive, neutral, negative_low/medium/high)
  - Risk score (0-100)
  - Crisis level (1-5)
  - Suggested action (monitor, respond, escalate, legal_review)
  - Responsible department
- **Mentions**: Danh sách mentions với AI analysis
  - View detail modal
  - Create alert from mention
  - Create incident from mention
- **Alerts**: Quản lý cảnh báo
  - Auto-create khi risk score >= 70
  - Acknowledge/Resolve alerts
- **Incidents**: Quản lý sự cố
  - Create from mentions
  - Track status
  - Incident logs

## 🏗️ Tech Stack

**Backend:**
- FastAPI (Python 3.11)
- PostgreSQL
- SQLAlchemy (Sync)
- Pydantic v1
- BeautifulSoup4 + Feedparser (Web scraping)
- Dummy AI Service (rule-based)

**Frontend:**
- Next.js 14
- TypeScript
- Tailwind CSS
- Axios

**Deployment:**
- Backend: Render Web Service
- Frontend: Vercel
- Database: Render PostgreSQL

## 📦 Installation

### Backend (Local)

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Setup environment
copy .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
alembic upgrade head

# Create admin user
python -m app.scripts.create_admin

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Local)

```bash
cd frontend

# Install dependencies
npm install

# Setup environment
copy .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Run dev server
npm run dev
```

## 🧪 Testing Workflow

### 1. Đăng Ký & Đăng Nhập
```
1. Mở http://localhost:3000
2. Click "Đăng ký" → Nhập email, password, full name
3. Đăng nhập với tài khoản vừa tạo
```

### 2. Tạo Keyword Groups & Keywords
```
1. Vào "Từ khóa"
2. Click "Thêm nhóm" → Nhập tên (vd: "Chất lượng sản phẩm"), priority: 3
3. Click "Thêm từ khóa" → Nhập từ khóa (vd: "sản phẩm lỗi", "chất lượng tệ")
4. Tạo thêm vài keywords khác
```

### 3. Tạo Sources
```
1. Vào "Nguồn"
2. Click "Thêm nguồn"
3. Nhập:
   - Tên: VnExpress
   - URL: https://vnexpress.net/rss/tin-moi-nhat.rss
   - Loại: RSS Feed
4. Tạo thêm vài sources khác
```

### 4. Thực Hiện Scan
```
1. Vào "Scan Center"
2. Chọn keyword groups (check boxes)
3. OPTION A: Chọn sources có sẵn
   OPTION B: Nhập URL tùy chỉnh (vd: https://vnexpress.net/rss/tin-moi-nhat.rss)
4. Click "Bắt Đầu Scan"
5. Đợi kết quả (sẽ hiện alert với số mentions tìm thấy)
```

### 5. Xem Mentions
```
1. Vào "Mentions"
2. Click icon "Eye" để xem chi tiết mention
3. Xem AI Analysis:
   - Sentiment
   - Risk Score
   - Crisis Level
   - Summary
   - Suggested Action
4. Click "Tạo Cảnh Báo" hoặc "Tạo Sự Cố"
```

### 6. Quản Lý Alerts
```
1. Vào "Cảnh báo"
2. Xem danh sách alerts (auto-created nếu risk >= 70)
3. Click "Check" để Acknowledge
4. Click "X" để Resolve
5. Filter theo status: new, acknowledged, resolved
```

### 7. Quản Lý Incidents
```
1. Vào "Sự cố"
2. Xem danh sách incidents
3. View detail để xem logs, status
```

### 8. Dashboard
```
1. Vào "Dashboard"
2. Xem metrics:
   - Tổng mentions
   - Mentions hôm nay
   - Mentions tiêu cực
   - Alerts
   - Incidents
   - Sources
3. Xem "Mentions Mới Nhất"
4. Xem "Cảnh Báo Mới Nhất"
```

## 🌐 Production URLs

- **Frontend**: https://social-listening-azure.vercel.app
- **Backend**: https://social-listening-backend.onrender.com
- **API Docs**: https://social-listening-backend.onrender.com/docs

## 🔑 Test Account

```
Email: admin@sociallistening.com
Password: Admin@123456
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard` - Get dashboard metrics

### Keywords
- `GET /api/keywords/groups` - List keyword groups
- `POST /api/keywords/groups` - Create keyword group
- `POST /api/keywords/keywords` - Create keyword
- `PUT /api/keywords/keywords/{id}` - Update keyword
- `DELETE /api/keywords/keywords/{id}` - Delete keyword

### Sources
- `GET /api/sources` - List sources
- `POST /api/sources` - Create source
- `PUT /api/sources/{id}` - Update source
- `DELETE /api/sources/{id}` - Delete source

### Scan/Crawl
- `POST /api/crawl/manual-scan` - Manual scan
- `GET /api/crawl/scan-history` - Get scan history

### Mentions
- `GET /api/mentions` - List mentions (with pagination, filters)
- `GET /api/mentions/{id}` - Get mention detail
- `DELETE /api/mentions/{id}` - Delete mention

### Alerts
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `POST /api/alerts/{id}/acknowledge` - Acknowledge alert
- `POST /api/alerts/{id}/resolve` - Resolve alert
- `DELETE /api/alerts/{id}` - Delete alert

### Incidents
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Create incident
- `PUT /api/incidents/{id}` - Update incident
- `GET /api/incidents/{id}/logs` - Get incident logs
- `DELETE /api/incidents/{id}` - Delete incident

## 🤖 AI Analysis (Dummy)

Hiện tại sử dụng Dummy AI (rule-based) để phân tích:

**Negative Keywords** (Vietnamese + English):
- tệ, kém, dở, tồi, lừa đảo, scam, fake, giả mạo
- bad, terrible, awful, worst, fraud, cheat
- không tốt, thất vọng, disappointed, angry
- lỗi, error, bug, broken, hỏng, sai
- chậm, slow, delay, trễ

**Crisis Keywords** (High Risk):
- chết, death, die, tử vong, nguy hiểm, danger
- bệnh viện, hospital, cấp cứu, emergency
- kiện, lawsuit, sue, court, tòa án
- scandal, bê bối, rò rỉ, leak, hack
- virus, nhiễm độc, poison, toxic

**Risk Calculation**:
- Base risk: 30
- +10 per negative keyword
- +20 per crisis keyword
- Max: 100

**Crisis Level**:
- Level 5: Crisis keywords detected
- Level 4: Risk >= 80
- Level 3: Risk >= 60
- Level 2: Risk >= 40
- Level 1: Risk < 40

**Suggested Actions**:
- `legal_review`: Crisis level >= 4
- `escalate`: Crisis level >= 3
- `respond`: Risk >= 50
- `monitor`: Risk < 50

## 🚀 Deployment

### Backend (Render)

```bash
# Push to GitHub
git add -A
git commit -m "Update backend"
git push origin main

# Render will auto-deploy
# Check logs at: https://dashboard.render.com
```

**Environment Variables** (Render):
```
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key
FRONTEND_URL=https://social-listening-azure.vercel.app
PYTHON_VERSION=3.11.9
```

**Start Command**:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel)

```bash
# Push to GitHub
git add -A
git commit -m "Update frontend"
git push origin main

# Vercel will auto-deploy
```

**Environment Variables** (Vercel):
```
NEXT_PUBLIC_API_URL=https://social-listening-backend.onrender.com
```

## 📊 Database Schema

**Main Tables**:
- `users` - User accounts
- `keyword_groups` - Keyword groups
- `keywords` - Keywords for monitoring
- `source_groups` - Source groups
- `sources` - Data sources (websites, RSS, social media)
- `mentions` - Collected mentions
- `ai_analysis` - AI analysis results
- `alerts` - System alerts
- `incidents` - Incidents to handle
- `incident_logs` - Incident activity logs

## ⚠️ Important Notes

1. **No Docker** - Direct installation only
2. **Legal Compliance** - Only public source monitoring, no hacking/DDoS/spam
3. **Dummy AI** - Current AI is rule-based, replace with real AI (OpenAI, Gemini) in production
4. **Manual Approval** - All legal responses require human approval
5. **Sync Database** - Using sync SQLAlchemy (not async)
6. **CORS** - Currently allows all origins (`["*"]`) for development

## 🔄 Future Enhancements

- [ ] Real AI integration (OpenAI, Gemini, Claude)
- [ ] Automated scheduled scans
- [ ] Email/Telegram notifications
- [ ] Response templates
- [ ] Legal takedown workflow
- [ ] Evidence file uploads
- [ ] Advanced analytics & charts
- [ ] Export reports (PDF, Excel)
- [ ] Multi-user roles & permissions
- [ ] Webhook integrations

## 📞 Support

For issues or questions, please create an issue on GitHub.

## 📄 License

MIT License
