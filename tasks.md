# Development Tasks

## Setup & Run
- [x] Remove Docker/Docker Compose
- [x] Create run.bat for Windows
- [x] Update .env.example files
- [x] Local PostgreSQL setup
- [x] Local Redis setup
- [x] Meilisearch optional

## Core Features
- [x] Keyword management
- [x] Source management (Facebook, YouTube, News, RSS)
- [x] Manual crawling
- [x] Scheduled crawling (Celery Beat)
- [x] AI analysis (OpenAI, Gemini, Anthropic, DeepSeek, Dummy)
- [x] Alert system
- [x] Incident management
- [x] Report generation (PDF, Excel)
- [x] Takedown tools

## Services
- [x] Notification service (Email, Telegram, SMS)
- [x] Report service (PDF, Excel)
- [x] Takedown service (Facebook, YouTube, Google DMCA, Legal)
- [x] Crawler service
- [x] AI service (pluggable providers)

## Background Tasks
- [x] Crawl source
- [x] Analyze mention
- [x] Send alert
- [x] Generate report
- [x] Capture screenshot
- [x] Check overdue incidents
- [x] Process scheduled crawls
- [x] Daily/weekly reports

## API Endpoints
- [x] /api/auth - Authentication
- [x] /api/keywords - Keyword management
- [x] /api/sources - Source management
- [x] /api/crawl - Crawling
- [x] /api/mentions - Mentions
- [x] /api/alerts - Alerts
- [x] /api/incidents - Incidents
- [x] /api/reports - Reports
- [x] /api/dashboard - Dashboard metrics
- [x] /api/takedown - Takedown tools

## Frontend (Basic Structure)
- [ ] Login page
- [ ] Dashboard page
- [ ] Keywords page
- [ ] Sources page
- [ ] Mentions page
- [ ] Alerts page
- [ ] Incidents page
- [ ] Reports page

## Future Enhancements
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced analytics
- [ ] Custom report templates
- [ ] Multi-language support
- [ ] Mobile app
