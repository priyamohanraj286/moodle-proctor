# Testing Guide

Comprehensive testing guide for the Moodle Proctor system.

## Table of Contents

1. [Unit Testing](#unit-testing)
2. [Integration Testing](#integration-testing)
3. [End-to-End Testing](#end-to-end-testing)
4. [Manual Testing](#manual-testing)
5. [API Testing](#api-testing)
6. [Performance Testing](#performance-testing)

---

## Unit Testing

### Backend Unit Tests

#### Security Services Tests

The security services have been tested with `backend/scripts/test-security.ts`:

```bash
cd backend
npm run test:security
```

**Test Coverage:**
- ✅ Frame signature generation (21 tests)
- ✅ Signature verification
- ✅ Replay attack prevention
- ✅ Rate limiting
- ✅ Frame integrity hashing

All tests should pass:
```
Running security service tests...
✓ Signature service created
✓ Frame signed successfully
✓ Valid signature accepted
✓ Invalid signature rejected
✓ Expired signature rejected
✓ Tampered data rejected
✓ Replay prevention tracks sequences
✓ Duplicate sequence rejected
✓ Old sequences rejected
✓ Cleanup works correctly
✓ Rate limiting allows under limit
✓ Rate limiting blocks over limit
✓ Sliding window works correctly
✓ Rate limit reset works
✓ Concurrent requests handled
✓ IP-based limiting works
✓ User-based limiting works
✓ Integrity hash generated
✓ Integrity hash verified
✓ Invalid hash rejected
✓ Tampered data rejected

Security tests: 21 passed, 0 failed
```

#### Running All Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- security.test.ts
```

---

## Integration Testing

### Database Integration

#### Test Database Connection

```bash
cd backend

# Check database connection
npm run db:check

# Run migrations
npm run migrate

# Check migration status
npm run migrate:status
```

#### Test Seed Data

```bash
# Seed test data
npm run seed

# Verify seed data
psql -h localhost -U proctor -d proctor_db -c "SELECT * FROM users;"
psql -h localhost -U proctor -d proctor_db -c "SELECT * FROM exams;"
psql -h localhost -U proctor -d proctor_db -c "SELECT * FROM exam_attempts;"
```

### API Integration Tests

#### Test Auth Flow

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"password123"}'

# Get current user
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Test Exam Flow

```bash
# Start exam
curl -X POST http://localhost:3000/api/exam/start \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"examId":1}'

# Submit exam
curl -X POST http://localhost:3000/api/exam/submit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"attemptId":1,"submissionReason":"manual_submit","answers":{}}'
```

---

## End-to-End Testing

### Prerequisites

1. **Start PostgreSQL**
   ```bash
   docker-compose up -d postgres
   ```

2. **Run Migrations**
   ```bash
   cd backend
   npm run migrate
   npm run seed
   ```

3. **Start Backend**
   ```bash
   npm run dev
   ```

4. **Start AI Proctoring Service** (optional)
   ```bash
   cd ai_proctoring
   python main.py
   ```

### E2E Test Scenarios

#### Scenario 1: Student Takes Exam

1. **Login**
   - Email: `student1@example.com`
   - Password: `password123`

2. **View Dashboard**
   - Verify exam list displays
   - Check attempt status

3. **Start Exam**
   - Click "Start Exam" button
   - Verify proctoring session starts
   - Check timer begins

4. **Submit Exam**
   - Answer questions
   - Click "Submit Exam"
   - Verify submission recorded

5. **View Results**
   - Check submission status
   - Verify answers stored

#### Scenario 2: Teacher Monitors Exam

1. **Login as Teacher**
   - Email: `teacher1@example.com`
   - Password: `password123`

2. **View Dashboard**
   - Check statistics display
   - Verify active students count
   - Review violation count

3. **Monitor Live Session**
   - Open monitoring page
   - Verify student cards display
   - Check real-time updates work

4. **View Violations**
   - Click on student card
   - Review violation list
   - Check severity levels

5. **Generate Reports**
   - Select date range
   - Choose exam
   - Export report

#### Scenario 3: Violation Detection

1. **Student Starts Exam**
   - Login as student
   - Begin proctored exam

2. **Trigger Violation**
   - Cover camera
   - Leave frame
   - Multiple people visible

3. **Verify Detection**
   - Check violation logged
   - Verify count increments
   - Check warning threshold

4. **Auto-Submit Test**
   - Trigger 15 violations
   - Verify auto-submit occurs
   - Check termination reason

#### Scenario 4: Manual Proctoring

1. **Open Electron App**
   ```bash
   cd manual_proctoring
   npm start
   ```

2. **Login**
   - Email: `student1@example.com`
   - Password: `password123`

3. **Start Exam**
   - Click "Start Exam"
   - Verify timer starts

4. **Report Violations**
   - Click violation buttons
   - Verify warnings increment

5. **Submit Exam**
   - Click "Submit Exam"
   - Verify completion

---

## Manual Testing

### Backend Health Checks

#### Check Backend Status

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 123.456,
  "database": "connected",
  "environment": "development",
  "version": "1.0.0"
}
```

#### Test Database Connection

```bash
psql -h localhost -U proctor -d proctor_db -c "SELECT 1;"
```

### Frontend Testing

#### Teacher Dashboard

1. **Login Page**
   - [ ] Email field accepts input
   - [ ] Password field accepts input
   - [ ] Login button works
   - [ ] Error messages display

2. **Dashboard Overview**
   - [ ] Statistics cards display
   - [ ] Active students grid shows
   - [ ] Real-time updates work

3. **Monitoring Page**
   - [ ] Student cards display
   - [ ] Status badges correct
   - [ ] Violation counts accurate

4. **Reports Page**
   - [ ] Filters work
   - [ ] Table displays data
   - [ ] Export button works

5. **Alerts Page**
   - [ ] Live alerts show
   - [ ] Severity indicators correct
   - [ ] Auto-refresh works

#### Student Dashboard

1. **Login**
   - [ ] Can login with student credentials
   - [ ] Redirected to dashboard

2. **Exam List**
   - [ ] Available exams display
   - [ ] Attempt history shows

3. **Taking Exam**
   - [ ] Exam starts successfully
   - [ ] Camera permission requested
   - [ ] Proctoring connects
   - [ ] Timer counts down
   - [ ] Can submit answers

### WebSocket/SSE Testing

#### Test WebSocket Connection

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3001/ws/proctor?token=YOUR_TOKEN');

ws.onopen = () => console.log('WebSocket connected');
ws.onmessage = (event) => console.log('Message:', event.data);

// Send test frame
ws.send(JSON.stringify({
  type: 'frame',
  frameId: 1,
  sequence: 1,
  timestamp: Date.now(),
  frame: 'base64_encoded_image',
  attemptId: 1,
  sessionId: 'test-session'
}));
```

#### Test SSE Connection

```javascript
// In browser console
const eventSource = new EventSource('http://localhost:3000/api/teacher/events?token=YOUR_TOKEN');

eventSource.addEventListener('violation', (e) => {
  console.log('Violation:', JSON.parse(e.data));
});

eventSource.addEventListener('exam_start', (e) => {
  console.log('Exam started:', JSON.parse(e.data));
});
```

---

## API Testing

### Using Postman/Insomnia

#### Import Collection

Create a new collection and add these requests:

1. **Login**
   - Method: POST
   - URL: `http://localhost:3000/api/auth/login`
   - Body: `{"username":"teacher1","password":"password123"}`

2. **Get Stats**
   - Method: GET
   - URL: `http://localhost:3000/api/teacher/stats`
   - Auth: Bearer Token (from login response)

3. **Get Attempts**
   - Method: GET
   - URL: `http://localhost:3000/api/teacher/attempts?status=in_progress&limit=10`
   - Auth: Bearer Token

### Using cURL

#### Auth Endpoints

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"password123"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"

# Get current user
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

#### Teacher Endpoints

```bash
# Get stats
curl -X GET "http://localhost:3000/api/teacher/stats?timeRange=hour" \
  -H "Authorization: Bearer $TOKEN"

# Get exams
curl -X GET "http://localhost:3000/api/teacher/exams" \
  -H "Authorization: Bearer $TOKEN"

# Get attempts
curl -X GET "http://localhost:3000/api/teacher/attempts?status=in_progress&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Get attempt details
curl -X GET "http://localhost:3000/api/teacher/attempts/1" \
  -H "Authorization: Bearer $TOKEN"

# Get violations
curl -X GET "http://localhost:3000/api/teacher/attempts/1/violations" \
  -H "Authorization: Bearer $TOKEN"

# Get reports
curl -X GET "http://localhost:3000/api/teacher/reports?examId=1" \
  -H "Authorization: Bearer $TOKEN"
```

#### Student Endpoints

```bash
# Get student profile
curl -X GET "http://localhost:3000/api/student" \
  -H "Authorization: Bearer $STUDENT_TOKEN"

# Get exam details
curl -X GET "http://localhost:3000/api/exam/1" \
  -H "Authorization: Bearer $STUDENT_TOKEN"

# Start exam
curl -X POST "http://localhost:3000/api/exam/start" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"examId":1}'

# Submit exam
curl -X POST "http://localhost:3000/api/exam/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"attemptId":1,"submissionReason":"manual_submit","answers":{}}'
```

---

## Performance Testing

### Load Testing with Apache Bench

```bash
# Test login endpoint
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:3000/api/auth/login

# Test stats endpoint (replace TOKEN)
ab -n 1000 -c 10 \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/teacher/stats
```

### Database Performance

#### Check Query Performance

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze tables
ANALYZE users;
ANALYZE exams;
ANALYZE exam_attempts;
ANALYZE violations;
```

---

## Testing Checklist

### Pre-Deployment Checklist

- [ ] All unit tests pass
- [ ] Security tests pass (21/21)
- [ ] Database migrations run successfully
- [ ] Seed data loads correctly
- [ ] Backend health check returns "ok"
- [ ] Teacher can login and view dashboard
- [ ] Student can login and view exams
- [ ] Student can start exam
- [ ] Student can submit exam
- [ ] Violations are logged correctly
- [ ] Auto-submit triggers at threshold
- [ ] Teacher can monitor live sessions
- [ ] SSE real-time updates work
- [ ] WebSocket proxy connects to AI service
- [ ] Manual proctoring Electron app works
- [ ] API documentation is up to date

### Smoke Tests

After any deployment, run these quick smoke tests:

```bash
# 1. Backend is running
curl http://localhost:3000/health

# 2. Can login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"password123"}'

# 3. Database is connected
psql -h localhost -U proctor -d proctor_db -c "SELECT COUNT(*) FROM users;"
```

---

## Debugging

### Enable Debug Logging

```bash
# Backend
export LOG_LEVEL=debug
npm run dev

# Database
export PGPASSWORD=proctor
psql -h localhost -U proctor -d proctor_db
```

### Check Logs

```bash
# Backend logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Database logs
docker-compose logs postgres

# AI Service logs
cd ai_proctoring
python main.py --log-level debug
```

---

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Run migrations
        run: |
          cd backend
          npm run migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Run tests
        run: |
          cd backend
          npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Security tests
        run: |
          cd backend
          npm run test:security
```

---

## Test Data

### Seed Users

**Teachers:**
- teacher1@example.com / password123
- teacher2@example.com / password123

**Students:**
- student1@example.com / password123
- student2@example.com / password123
- student3@example.com / password123

**Admin:**
- admin@example.com / admin123

### Seed Exams

1. Physics Midterm - 60 minutes
2. Math Final - 90 minutes
3. Chemistry Quiz - 30 minutes

---

## Troubleshooting Tests

### Tests Fail to Connect to Database

**Solution:** Ensure PostgreSQL is running:
```bash
docker-compose up -d postgres
```

### Security Tests Fail

**Solution:** Check cryptographic dependencies:
```bash
cd backend
npm install
npm run test:security
```

### E2E Tests Fail

**Solution:** Check all services are running:
```bash
# Backend
cd backend && npm run dev

# AI Service
cd ai_proctoring && python main.py

# Frontend
cd frontend && npm run dev
```

---

## Next Steps

1. Set up automated testing pipeline
2. Add more unit tests for business logic
3. Implement integration tests for API endpoints
4. Add E2E tests with Playwright
5. Set up load testing for performance monitoring
