# 🔥 Smoke Test Failures - Detailed Analysis & Fixes

**Test Date:** 2026-05-10  
**Results:** 12/22 passed (54.5%)  
**Status:** 10 failures need fixing

---

## ✅ PASSING MODULES (12/22)

1. ✅ Auth - GET /api/auth/me
2. ✅ Dashboard - GET /api/dashboard
3. ✅ Keywords - GET /api/keywords/groups
4. ✅ Keywords - POST /api/keywords/groups
5. ✅ Sources - GET /api/sources/groups
6. ✅ Scan - GET /api/crawl/scan-history
7. ✅ Mentions - GET /api/mentions
8. ✅ Alerts - GET /api/alerts
9. ✅ Incidents - GET /api/incidents
10. ✅ Services - GET /api/services/dashboard-summary
11. ✅ Services - GET /api/services/categories
12. ✅ Services - GET /api/services

---

## ❌ FAILING TESTS - DETAILED BREAKDOWN

### 1. Keywords - GET /api/keywords/groups/{id} (500)

**Route:** `GET /api/keywords/groups/1`  
**Status:** 500 Internal Server Error  
**Error:** Internal Server Error

**Root Cause:** Likely still using `.from_orm()` incorrectly or missing relationship loading

**Fix Needed:**
```python
# backend/app/api/keywords.py
@router.get("/groups/{group_id}", response_model=KeywordGroupResponse)
def get_keyword_group(...):
    query = select(KeywordGroup).where(KeywordGroup.id == group_id).options(selectinload(KeywordGroup.keywords))
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    # Make sure relationships are loaded
    return KeywordGroupResponse.from_orm(group)
```

**Priority:** HIGH

---

### 2. Keywords - POST /api/keywords/keywords (422)

**Route:** `POST /api/keywords/keywords`  
**Status:** 422 Validation Error  
**Payload:**
```json
{
  "group_id": 1,
  "keyword": "test keyword",
  "keyword_type": "general",
  "logic_operator": "or"
}
```

**Error:**
```
value is not a valid enumeration member; permitted: 'AND', 'OR', 'NOT'
```

**Root Cause:** Frontend sending lowercase "or", backend expects uppercase "OR"

**Fix Needed:**
```python
# backend/app/models/keyword.py
class LogicOperator(str, Enum):
    AND = "AND"
    OR = "OR"
    NOT = "NOT"
```

Change to case-insensitive or update frontend to send uppercase.

**Suggested Fix:** Update enum to accept lowercase:
```python
class LogicOperator(str, Enum):
    AND = "and"
    OR = "or"
    NOT = "not"
```

**Priority:** HIGH

---

### 3. Sources - GET /api/sources (500)

**Route:** `GET /api/sources`  
**Status:** 500 Internal Server Error

**Root Cause:** Likely serialization issue with SourceResponse

**Fix Needed:** Check if all fields in SourceResponse match database columns

**Priority:** HIGH

---

### 4. Sources - POST /api/sources (500)

**Route:** `POST /api/sources`  
**Status:** 500 Internal Server Error  
**Payload:**
```json
{
  "name": "Test Source",
  "source_type": "website",
  "url": "https://example.com",
  "is_active": true,
  "crawl_frequency": "manual"
}
```

**Root Cause:** Likely issue with `calculate_next_crawl_time()` function or missing fields

**Fix Needed:** Check sources.py create endpoint

**Priority:** HIGH

---

### 5. Scan - GET /api/crawl/jobs (404)

**Route:** `GET /api/crawl/jobs`  
**Status:** 404 Not Found

**Root Cause:** Endpoint doesn't exist

**Fix Needed:** Either implement endpoint or remove from frontend

**Priority:** MEDIUM

---

### 6. Scan - POST /api/crawl/manual-scan (400)

**Route:** `POST /api/crawl/manual-scan`  
**Status:** 400 Bad Request  
**Error:** "No active keywords found in selected groups"

**Root Cause:** Test group has no keywords yet (expected behavior)

**Fix Needed:** None - this is correct validation

**Priority:** LOW (Working as intended)

---

### 7. Incidents - POST /api/incidents (422)

**Route:** `POST /api/incidents`  
**Status:** 422 Validation Error  
**Error:**
```
field required: mention_id, title (in query params)
```

**Payload:**
```json
{
  "title": "Test Incident",
  "description": "Smoke test incident",
  "severity": "medium",
  "status": "open",
  "priority": "medium"
}
```

**Root Cause:** Backend expects query params, frontend sends JSON body

**Fix Needed:**
```python
# backend/app/api/incidents.py
@router.post("", response_model=IncidentResponse)
def create_incident(
    incident_data: IncidentCreate,  # Body, not query params
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
```

**Priority:** HIGH

---

### 8. Services - GET /api/services/requests (422)

**Route:** `GET /api/services/requests`  
**Status:** 422 Validation Error  
**Error:**
```
path param service_id is not a valid integer
```

**Root Cause:** Route definition issue - should not have path param

**Current (Wrong):**
```python
@router.get("/requests/{service_id}")
```

**Fix Needed:**
```python
@router.get("/requests")
def list_service_requests(
    skip: int = Query(0),
    limit: int = Query(100),
    ...
):
```

**Priority:** HIGH

---

### 9. Reports - GET /api/reports (500)

**Route:** `GET /api/reports`  
**Status:** 500 Internal Server Error

**Root Cause:** Async/sync mismatch or serialization issue

**Fix Needed:** Check if reports.py is using async correctly

**Priority:** MEDIUM

---

### 10. Takedown - GET /api/takedown/requests (404)

**Route:** `GET /api/takedown/requests`  
**Status:** 404 Not Found

**Root Cause:** Endpoint doesn't exist

**Fix Needed:** Either implement endpoint or remove from frontend

**Priority:** LOW

---

## 🎯 PRIORITY FIX ORDER

### Immediate (HIGH Priority):
1. Fix Keywords enum case sensitivity
2. Fix Incidents POST endpoint (query vs body)
3. Fix Services requests route (remove path param)
4. Fix Sources GET 500 error
5. Fix Sources POST 500 error
6. Fix Keywords GET by ID 500 error

### Medium Priority:
7. Fix Reports GET 500 error
8. Implement or remove /api/crawl/jobs endpoint

### Low Priority:
9. Implement or remove /api/takedown/requests endpoint
10. Scan manual-scan 400 is expected behavior

---

## 📊 SUCCESS RATE BY MODULE

| Module | Passed | Failed | Success Rate |
|--------|--------|--------|--------------|
| Auth | 1 | 0 | 100% ✅ |
| Dashboard | 1 | 0 | 100% ✅ |
| Keywords | 2 | 2 | 50% ⚠️ |
| Sources | 1 | 2 | 33% ❌ |
| Scan | 1 | 2 | 33% ❌ |
| Mentions | 1 | 0 | 100% ✅ |
| Alerts | 1 | 0 | 100% ✅ |
| Incidents | 1 | 1 | 50% ⚠️ |
| Services | 3 | 1 | 75% ⚠️ |
| Reports | 0 | 1 | 0% ❌ |
| Takedown | 0 | 1 | 0% ❌ |

---

## 🔧 NEXT STEPS

1. Fix enum case sensitivity issues
2. Fix route parameter mismatches
3. Fix async/sync issues in reports
4. Test again after fixes
5. Verify all modules work end-to-end
