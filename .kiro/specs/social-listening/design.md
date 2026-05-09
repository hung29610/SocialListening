# Social Listening Platform - Design Document

## System Architecture

### Overview
The Social Listening Platform is a web application designed to monitor, analyze, and manage brand reputation across multiple public sources. The system follows a modern three-tier architecture without Docker containers.

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                  Next.js + TypeScript                        │
│                  Deployed on Vercel                          │
│                  https://app.vercel.app                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                         Backend                              │
│                    FastAPI + Python                          │
│                  Deployed on Render                          │
│              https://api.onrender.com                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ PostgreSQL Protocol
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                        Database                              │
│                      PostgreSQL 14+                          │
│                Render Managed PostgreSQL                     │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **HTTP Client**: Axios
- **State Management**: React Hooks
- **Deployment**: Vercel

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **ORM**: SQLAlchemy (async)
- **Migrations**: Alembic
- **Validation**: Pydantic
- **Authentication**: JWT (python-jose)
- **Password Hashing**: bcrypt (passlib)
- **HTTP Client**: httpx, requests
- **Web Scraping**: BeautifulSoup4
- **RSS Parsing**: feedparser
- **Deployment**: Render Web Service

### Database
- **RDBMS**: PostgreSQL 14+
- **Local**: Direct installation on Windows
- **Production**: Render Managed PostgreSQL
- **Connection Pool**: SQLAlchemy async pool
- **Search**: PostgreSQL full-text search (Meilisearch optional)

### AI Integration
- **Architecture**: Pluggable provider interface
- **Providers**:
  - OpenAI (GPT-4, GPT-3.5)
  - Google Gemini
  - DeepSeek
  - Dummy (for testing)
- **Configuration**: Environment variables

## Database Design

### Core Tables

#### Authentication & Authorization
```sql
users
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- hashed_password: VARCHAR(255) NOT NULL
- full_name: VARCHAR(255)
- is_active: BOOLEAN DEFAULT TRUE
- is_superuser: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP

roles
- id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE NOT NULL
- description: TEXT
- created_at: TIMESTAMP

permissions
- id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE NOT NULL
- resource: VARCHAR(100)
- action: VARCHAR(50)
- created_at: TIMESTAMP

user_roles (many-to-many)
role_permissions (many-to-many)
```

#### Keyword Management
```sql
keyword_groups
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255) NOT NULL
- description: TEXT
- is_active: BOOLEAN DEFAULT TRUE
- created_by: INTEGER REFERENCES users(id)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

keywords
- id: SERIAL PRIMARY KEY
- keyword_group_id: INTEGER REFERENCES keyword_groups(id)
- keyword: VARCHAR(500) NOT NULL
- is_negative: BOOLEAN DEFAULT FALSE
- match_type: VARCHAR(50) DEFAULT 'contains'
- priority: INTEGER DEFAULT 0
- created_at: TIMESTAMP
```

#### Source Management
```sql
source_groups
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255) NOT NULL
- description: TEXT
- created_at: TIMESTAMP

sources
- id: SERIAL PRIMARY KEY
- source_group_id: INTEGER REFERENCES source_groups(id)
- name: VARCHAR(255) NOT NULL
- url: TEXT NOT NULL
- platform_type: VARCHAR(50) NOT NULL
- crawl_frequency_minutes: INTEGER DEFAULT 60
- is_active: BOOLEAN DEFAULT TRUE
- last_crawled_at: TIMESTAMP
- metadata: JSONB
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Crawling & Scheduling
```sql
scan_schedules
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255) NOT NULL
- keyword_group_ids: JSONB
- source_group_ids: JSONB
- cron_expression: VARCHAR(100)
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP

crawl_jobs
- id: SERIAL PRIMARY KEY
- job_type: VARCHAR(50) NOT NULL
- source_ids: JSONB
- keyword_group_ids: JSONB
- status: VARCHAR(50) DEFAULT 'pending'
- total_sources: INTEGER
- processed_sources: INTEGER DEFAULT 0
- mentions_found: INTEGER DEFAULT 0
- error_message: TEXT
- created_at: TIMESTAMP
- started_at: TIMESTAMP
- completed_at: TIMESTAMP
```

#### Mentions & Analysis
```sql
mentions
- id: SERIAL PRIMARY KEY
- source_id: INTEGER REFERENCES sources(id)
- title: TEXT
- content_snippet: TEXT
- url: TEXT NOT NULL
- platform_type: VARCHAR(50)
- published_at: TIMESTAMP
- detected_at: TIMESTAMP DEFAULT NOW()
- matched_keywords: JSONB
- engagement_metrics: JSONB
- raw_metadata: JSONB
- created_at: TIMESTAMP

ai_analysis
- id: SERIAL PRIMARY KEY
- mention_id: INTEGER REFERENCES mentions(id) UNIQUE
- sentiment: VARCHAR(50) NOT NULL
- risk_score: FLOAT NOT NULL
- crisis_level: INTEGER NOT NULL
- summary_vi: TEXT
- suggested_action: VARCHAR(100)
- responsible_department: VARCHAR(100)
- confidence_score: FLOAT
- reasoning: TEXT
- ai_provider: VARCHAR(50)
- analyzed_at: TIMESTAMP DEFAULT NOW()
```

#### Alerts & Incidents
```sql
alerts
- id: SERIAL PRIMARY KEY
- mention_id: INTEGER REFERENCES mentions(id)
- severity: VARCHAR(50) NOT NULL
- status: VARCHAR(50) DEFAULT 'new'
- title: VARCHAR(500) NOT NULL
- message: TEXT
- assigned_to: INTEGER REFERENCES users(id)
- acknowledged_at: TIMESTAMP
- resolved_at: TIMESTAMP
- created_at: TIMESTAMP

incidents
- id: SERIAL PRIMARY KEY
- title: VARCHAR(500) NOT NULL
- description: TEXT
- status: VARCHAR(50) DEFAULT 'new'
- severity: VARCHAR(50) NOT NULL
- assigned_to: INTEGER REFERENCES users(id)
- deadline: TIMESTAMP
- created_by: INTEGER REFERENCES users(id)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- closed_at: TIMESTAMP

incident_logs
- id: SERIAL PRIMARY KEY
- incident_id: INTEGER REFERENCES incidents(id)
- action: VARCHAR(100) NOT NULL
- description: TEXT
- user_id: INTEGER REFERENCES users(id)
- created_at: TIMESTAMP

evidence_files
- id: SERIAL PRIMARY KEY
- incident_id: INTEGER REFERENCES incidents(id)
- file_type: VARCHAR(50)
- file_url: TEXT
- metadata: JSONB
- created_at: TIMESTAMP
```

#### Legal & Takedown
```sql
takedown_requests
- id: SERIAL PRIMARY KEY
- mention_id: INTEGER REFERENCES mentions(id)
- incident_id: INTEGER REFERENCES incidents(id)
- request_type: VARCHAR(50) NOT NULL
- platform: VARCHAR(50)
- draft_content: TEXT
- status: VARCHAR(50) DEFAULT 'draft'
- approved_by: INTEGER REFERENCES users(id)
- approved_at: TIMESTAMP
- sent_at: TIMESTAMP
- created_at: TIMESTAMP

response_templates
- id: SERIAL PRIMARY KEY
- template_type: VARCHAR(50) NOT NULL
- title: VARCHAR(255) NOT NULL
- content: TEXT NOT NULL
- variables: JSONB
- created_at: TIMESTAMP
```

#### Reporting
```sql
reports
- id: SERIAL PRIMARY KEY
- report_type: VARCHAR(50) NOT NULL
- title: VARCHAR(255) NOT NULL
- date_from: DATE
- date_to: DATE
- data: JSONB
- generated_by: INTEGER REFERENCES users(id)
- created_at: TIMESTAMP
```

#### System
```sql
audit_logs
- id: SERIAL PRIMARY KEY
- user_id: INTEGER REFERENCES users(id)
- action: VARCHAR(100) NOT NULL
- resource_type: VARCHAR(100)
- resource_id: INTEGER
- ip_address: VARCHAR(50)
- details: JSONB
- created_at: TIMESTAMP

system_settings
- id: SERIAL PRIMARY KEY
- key: VARCHAR(100) UNIQUE NOT NULL
- value: JSONB
- updated_at: TIMESTAMP

notification_channels
- id: SERIAL PRIMARY KEY
- channel_type: VARCHAR(50) NOT NULL
- config: JSONB
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_mentions_source_id ON mentions(source_id);
CREATE INDEX idx_mentions_detected_at ON mentions(detected_at);
CREATE INDEX idx_mentions_platform_type ON mentions(platform_type);
CREATE INDEX idx_ai_analysis_sentiment ON ai_analysis(sentiment);
CREATE INDEX idx_ai_analysis_risk_score ON ai_analysis(risk_score);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Full-text search indexes
CREATE INDEX idx_mentions_content_fts ON mentions USING GIN(to_tsvector('english', content_snippet));
CREATE INDEX idx_mentions_title_fts ON mentions USING GIN(to_tsvector('english', title));
```

## API Design

### Authentication Endpoints

```
POST   /api/auth/login          # Login with email/password
POST   /api/auth/register       # Register new user
GET    /api/auth/me             # Get current user
POST   /api/auth/logout         # Logout
POST   /api/auth/refresh        # Refresh token
```

### Keyword Management

```
GET    /api/keywords/groups                    # List keyword groups
POST   /api/keywords/groups                    # Create keyword group
GET    /api/keywords/groups/{id}               # Get keyword group
PUT    /api/keywords/groups/{id}               # Update keyword group
DELETE /api/keywords/groups/{id}               # Delete keyword group

GET    /api/keywords/keywords                  # List keywords
POST   /api/keywords/keywords                  # Create keyword
GET    /api/keywords/keywords/{id}             # Get keyword
PUT    /api/keywords/keywords/{id}             # Update keyword
DELETE /api/keywords/keywords/{id}             # Delete keyword
```

### Source Management

```
GET    /api/sources                            # List sources
POST   /api/sources                            # Create source
GET    /api/sources/{id}                       # Get source
PUT    /api/sources/{id}                       # Update source
DELETE /api/sources/{id}                       # Delete source
POST   /api/sources/{id}/test                  # Test source connection
```

### Crawling

```
POST   /api/crawl/manual                       # Trigger manual crawl
GET    /api/crawl/jobs                         # List crawl jobs
GET    /api/crawl/jobs/{id}                    # Get crawl job status
POST   /api/crawl/schedule                     # Create scan schedule
GET    /api/crawl/schedules                    # List schedules
```

### Mentions

```
GET    /api/mentions                           # List mentions
GET    /api/mentions/{id}                      # Get mention detail
POST   /api/mentions/search                    # Search mentions
GET    /api/mentions/{id}/analysis             # Get AI analysis
POST   /api/mentions/{id}/reanalyze            # Reanalyze with AI
```

### Alerts

```
GET    /api/alerts                             # List alerts
GET    /api/alerts/{id}                        # Get alert
POST   /api/alerts/{id}/acknowledge            # Acknowledge alert
POST   /api/alerts/{id}/assign                 # Assign alert
POST   /api/alerts/{id}/resolve                # Resolve alert
```

### Incidents

```
GET    /api/incidents                          # List incidents
POST   /api/incidents                          # Create incident
GET    /api/incidents/{id}                     # Get incident
PUT    /api/incidents/{id}                     # Update incident
POST   /api/incidents/{id}/logs                # Add log entry
POST   /api/incidents/{id}/evidence            # Add evidence
POST   /api/incidents/{id}/close               # Close incident
```

### Takedown

```
POST   /api/takedown/draft-request             # Generate takedown draft
POST   /api/takedown/draft-correction          # Generate correction draft
POST   /api/takedown/draft-response            # Generate response draft
GET    /api/takedown/requests                  # List takedown requests
POST   /api/takedown/requests/{id}/approve     # Approve request
POST   /api/takedown/requests/{id}/send        # Send request
```

### Reports

```
GET    /api/reports                            # List reports
POST   /api/reports/generate                   # Generate report
GET    /api/reports/{id}                       # Get report
GET    /api/reports/{id}/download              # Download report
```

### Dashboard

```
GET    /api/dashboard                          # Get dashboard data
GET    /api/dashboard/sentiment-trend          # Sentiment over time
GET    /api/dashboard/source-stats             # Source statistics
GET    /api/dashboard/keyword-performance      # Keyword performance
```

## Frontend Design

### Page Structure

```
/                           # Home (redirect to /login or /dashboard)
/login                      # Login page
/dashboard                  # Main dashboard
/dashboard/keywords         # Keyword management
/dashboard/sources          # Source management
/dashboard/scan             # Scan center
/dashboard/mentions         # Mention list
/dashboard/alerts           # Alert center
/dashboard/incidents        # Incident management
/dashboard/reports          # Reports
/dashboard/takedown         # Takedown workflow
/dashboard/settings         # Settings
```

### Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   ├── Header
│   └── Main Content
│       ├── Dashboard
│       │   ├── MetricCards
│       │   ├── SentimentChart
│       │   ├── MentionTrend
│       │   └── TopRiskyMentions
│       ├── Keywords
│       │   ├── GroupList
│       │   ├── KeywordList
│       │   └── CreateModal
│       ├── Sources
│       │   ├── SourceList
│       │   ├── SourceCard
│       │   └── AddSourceModal
│       ├── Mentions
│       │   ├── FilterBar
│       │   ├── MentionList
│       │   └── MentionDetail
│       ├── Alerts
│       │   ├── AlertList
│       │   ├── AlertCard
│       │   └── ActionButtons
│       └── Incidents
│           ├── IncidentList
│           ├── IncidentDetail
│           └── Timeline
└── Login
```

## AI Integration Design

### Provider Interface

```python
class AIProvider(ABC):
    @abstractmethod
    async def analyze_sentiment(self, text: str) -> SentimentResult:
        pass
    
    @abstractmethod
    async def generate_summary(self, text: str) -> str:
        pass
    
    @abstractmethod
    async def draft_response(self, context: dict) -> str:
        pass
```

### Prompt Templates

Stored in `backend/app/services/prompts/`:
- `sentiment_analysis.txt`
- `risk_scoring.txt`
- `crisis_classification.txt`
- `summary_generation.txt`
- `response_draft.txt`
- `takedown_request.txt`

### Analysis Flow

```
Mention Created
    ↓
AI Service Called
    ↓
Provider Selected (based on AI_PROVIDER env)
    ↓
Prompt Template Loaded
    ↓
API Call to Provider
    ↓
Response Parsed
    ↓
AI Analysis Record Created
    ↓
Alert Created (if risk_score >= threshold)
```

## Security Design

### Authentication Flow

```
1. User submits email/password
2. Backend validates credentials
3. Backend generates JWT token
4. Token returned to frontend
5. Frontend stores token in localStorage
6. Frontend includes token in Authorization header
7. Backend validates token on each request
8. Backend checks user permissions
```

### RBAC Design

```
Roles:
- Admin: Full access
- Manager: Manage keywords, sources, incidents
- Analyst: View and analyze mentions
- Viewer: Read-only access

Permissions:
- keywords:read, keywords:write, keywords:delete
- sources:read, sources:write, sources:delete
- mentions:read, mentions:analyze
- alerts:read, alerts:manage
- incidents:read, incidents:write, incidents:close
- reports:read, reports:generate
- takedown:draft, takedown:approve, takedown:send
- users:read, users:write, users:delete
```

### Data Protection

- Passwords hashed with bcrypt
- JWT tokens with expiration
- HTTPS only in production
- CORS restricted to frontend domain
- SQL injection prevention via ORM
- Input validation with Pydantic
- Rate limiting (future)
- Audit logging for sensitive actions

## Deployment Design

### Local Development

```
Windows Machine
├── PostgreSQL (direct install)
├── Backend (venv)
│   └── uvicorn (port 8000)
└── Frontend (npm)
    └── Next.js dev server (port 3000)
```

### Production

```
Vercel (Frontend)
    ↓ HTTPS
Render Web Service (Backend)
    ↓ PostgreSQL Protocol
Render Managed PostgreSQL (Database)
```

### Environment Configuration

**Local:**
- Backend: `backend/.env`
- Frontend: `frontend/.env.local`

**Production:**
- Backend: Render environment variables
- Frontend: Vercel environment variables

### CI/CD Flow

```
1. Push to GitHub main branch
2. Render auto-deploys backend
   - Runs: pip install -r requirements.txt
   - Runs: alembic upgrade head
   - Starts: uvicorn app.main:app
3. Vercel auto-deploys frontend
   - Runs: npm install
   - Runs: npm run build
   - Deploys to CDN
```

## Performance Considerations

### Database
- Connection pooling (10 connections, 20 max overflow)
- Indexes on frequently queried columns
- JSONB for flexible metadata
- Async queries with SQLAlchemy

### Backend
- Async/await for I/O operations
- Background tasks for crawling (future: Celery)
- Caching (future: Redis)
- Rate limiting (future)

### Frontend
- Server-side rendering (Next.js)
- Code splitting
- Image optimization
- CDN delivery (Vercel)
- Client-side caching

## Monitoring & Logging

### Application Logs
- Backend: Python logging module
- Frontend: Console logs (dev), Vercel logs (prod)
- Format: JSON structured logs

### Metrics
- API response times
- Database query times
- Crawl job success/failure rates
- Alert generation rates
- User activity

### Error Tracking
- Backend: Exception logging
- Frontend: Error boundaries
- Production: Sentry (future)

## Scalability Considerations

### Current Limits
- Single backend instance
- PostgreSQL connection pool: 10-20
- No caching layer
- No queue system

### Future Improvements
- Horizontal scaling with load balancer
- Redis for caching and sessions
- Celery for background tasks
- Meilisearch for advanced search
- CDN for static assets
- Database read replicas

---

**Version:** 1.0.0  
**Last Updated:** May 9, 2026
