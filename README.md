# Social Listening & Reputation Protection Platform

A comprehensive web application for monitoring, analyzing, and managing brand reputation across social media and news sources in Vietnamese.

## 🎯 Features

### 1. Multi-Source Monitoring
- Public websites and news
- RSS feeds
- YouTube public content (integration-ready)
- Facebook public sources (integration-ready)
- Manual URL input
- Custom source groups

### 2. Keyword Management
- Keyword groups
- Positive/negative keywords
- Excluded keywords
- Match types (exact, contains, starts with, ends with)
- Priority levels

### 3. AI-Powered Analysis
- Vietnamese sentiment analysis
- Risk scoring (0-100)
- Crisis level detection (1-5)
- Automated summaries
- Suggested actions
- Department recommendations

### 4. Alert System
- Real-time dashboard alerts
- Email notifications (ready)
- Telegram integration (ready)
- Webhook support (ready)
- Zalo integration (ready)
- Severity levels: LOW, MEDIUM, HIGH, CRITICAL

### 5. Incident Management
- Create incidents from mentions
- Assign owners and deadlines
- Status tracking
- Timeline logs
- Evidence collection
- Internal notes

### 6. Legal Takedown Workflow
- Evidence collection
- Takedown request drafts
- Correction request templates
- Platform report checklists
- Legal escalation workflow
- Human approval required

### 7. Reporting
- Daily/weekly/monthly reports
- Crisis reports
- Keyword performance
- Source risk analysis
- Export-ready formats

## 🏗️ Architecture

**Frontend:**
- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Recharts for analytics

**Backend:**
- FastAPI (Python)
- SQLAlchemy ORM
- Alembic migrations
- Pydantic validation
- Async/await support

**Database:**
- PostgreSQL 14+
- 22 tables with proper relationships
- Full-text search
- Optimized indexes

**AI Integration:**
- Pluggable provider interface
- OpenAI GPT-4
- Google Gemini
- DeepSeek
- Dummy provider for testing

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Git

### Local Development

**1. Clone Repository**
```bash
git clone https://github.com/yourusername/SocialListening.git
cd SocialListening
```

**2. Start PostgreSQL**
```cmd
# Windows: Start PostgreSQL service
Win + R → services.msc → postgresql → Start

# Or use command line
net start postgresql-x64-16
```

**3. Setup Backend**
```cmd
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Configure .env file
copy .env.example .env
# Edit .env with your settings

# Run migrations
alembic upgrade head

# Create admin user
python -m app.scripts.create_admin

# Start server
uvicorn app.main:app --reload
```

Backend runs at: http://localhost:8000

**4. Setup Frontend**
```cmd
cd frontend
npm install

# Configure environment
copy .env.example .env.local
# Edit .env.local

# Start server
npm run dev
```

Frontend runs at: http://localhost:3000

**5. Login**
- Email: `admin@example.com`
- Password: `admin123`

### Using Batch Files (Windows)

**First Time Setup:**
```cmd
setup-step-by-step.bat
```

**Run Application:**
```cmd
RUN.bat
```

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
- **[START_HERE.txt](START_HERE.txt)** - Quick start guide
- **[QUICK_START.txt](QUICK_START.txt)** - Fast reference
- **[PROJECT_STATUS.txt](PROJECT_STATUS.txt)** - Current status

## 🌐 Production Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Set root directory: `frontend`
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.onrender.com
   ```
5. Deploy

### Backend (Render)

1. Create PostgreSQL database on Render
2. Create Web Service
3. Set root directory: `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables:
   ```
   DATABASE_URL=<render-postgresql-url>
   FRONTEND_URL=https://your-app.vercel.app
   SECRET_KEY=<strong-random-key>
   ENVIRONMENT=production
   ```
7. Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 🗂️ Project Structure

```
SocialListening/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── core/             # Config, database, security
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   ├── workers/          # Background tasks
│   │   └── scripts/          # Utility scripts
│   ├── alembic/              # Database migrations
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages
│   │   │   ├── dashboard/    # Dashboard pages
│   │   │   └── login/        # Login page
│   │   └── lib/              # Utilities
│   ├── package.json          # Node dependencies
│   └── .env.local            # Environment variables
│
├── DEPLOYMENT.md             # Deployment guide
├── README.md                 # This file
└── RUN.bat                   # Windows launcher
```

## 🔧 Configuration

### Backend Environment Variables

```env
# App
ENVIRONMENT=development
DEBUG=True
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Security
SECRET_KEY=your-secret-key

# AI Provider
AI_PROVIDER=dummy
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=

# Notifications (optional)
TELEGRAM_BOT_TOKEN=
SMTP_HOST=smtp.gmail.com
SMTP_USER=
SMTP_PASSWORD=
```

### Frontend Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🧪 Testing

### Backend Tests
```cmd
cd backend
.\venv\Scripts\activate
pytest
```

### Frontend Tests
```cmd
cd frontend
npm test
```

### End-to-End Tests
1. Create keyword group
2. Add keywords
3. Add sources
4. Run manual scan
5. View mentions
6. Create alerts
7. Manage incidents

## 📊 Database Schema

22 tables including:
- `users`, `roles`, `permissions` - Authentication & RBAC
- `keyword_groups`, `keywords` - Keyword management
- `source_groups`, `sources` - Source management
- `mentions`, `ai_analysis` - Content collection & analysis
- `alerts`, `incidents` - Alert & incident management
- `reports`, `takedown_requests` - Reporting & legal workflow
- `audit_logs` - Audit trail

## 🤖 AI Integration

Pluggable AI provider system:

```python
# Configure in .env
AI_PROVIDER=openai  # or gemini, deepseek, dummy

# Add API key
OPENAI_API_KEY=sk-...
```

Supported providers:
- **OpenAI**: GPT-4, GPT-3.5
- **Google Gemini**: gemini-pro
- **DeepSeek**: deepseek-chat
- **Dummy**: For testing without API costs

## 🔒 Security

- JWT authentication
- Role-based access control (RBAC)
- Password hashing (bcrypt)
- SQL injection protection (ORM)
- CORS configuration
- Environment-based secrets
- Audit logging
- Human approval for legal actions

## 🌍 Internationalization

- Primary language: Vietnamese
- AI prompts optimized for Vietnamese
- Sentiment analysis for Vietnamese text
- Vietnamese UI labels (ready)

## 📈 Performance

- Async/await for I/O operations
- Database connection pooling
- Optimized queries with indexes
- CDN delivery (Vercel)
- Caching ready (Redis optional)

## 🛠️ Development

### Adding New Features

1. Update database models in `backend/app/models/`
2. Create migration: `alembic revision --autogenerate -m "description"`
3. Apply migration: `alembic upgrade head`
4. Add API endpoints in `backend/app/api/`
5. Create frontend pages in `frontend/src/app/`
6. Test locally
7. Deploy

### Code Style

**Backend:**
- Follow PEP 8
- Use type hints
- Async/await for I/O
- Pydantic for validation

**Frontend:**
- TypeScript strict mode
- Functional components
- Tailwind for styling
- ESLint + Prettier

## 🐛 Troubleshooting

### PostgreSQL not running
```cmd
Win + R → services.msc → postgresql → Start
```

### Port already in use
```cmd
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

### CORS errors
Check `FRONTEND_URL` in backend `.env` matches frontend URL.

### Database connection failed
Verify `DATABASE_URL` and PostgreSQL is running.

See [DEPLOYMENT.md](DEPLOYMENT.md) for more troubleshooting.

## 📝 License

Proprietary - All rights reserved

## 👥 Team

- Product Architect
- Full-Stack Engineer
- Backend Engineer
- Frontend Engineer
- DevOps Engineer
- QA Engineer
- AI Integration Engineer

## 📞 Support

For issues and questions:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md)
2. Review [PROJECT_STATUS.txt](PROJECT_STATUS.txt)
3. Check GitHub Issues
4. Contact support team

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Machine learning for trend prediction
- [ ] Multi-language support
- [ ] API rate limiting
- [ ] Webhook integrations
- [ ] Custom report templates
- [ ] Automated response suggestions

## 🎉 Acknowledgments

Built with:
- FastAPI
- Next.js
- PostgreSQL
- Tailwind CSS
- shadcn/ui
- Recharts

---

**Version:** 1.0.0  
**Last Updated:** May 9, 2026  
**Status:** Production Ready ✅
