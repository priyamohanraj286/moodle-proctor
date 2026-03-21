# Manual Proctoring Client Migration Guide

This guide explains how to migrate the Electron manual proctoring client from the dummy Express backend to the main backend.

## Overview

The manual proctoring client currently uses a dummy Express backend on port 5000. The main backend (built with Fastify) runs on port 3000 and includes all the necessary endpoints with full database integration.

## Architecture

### Before (Dummy Backend)
```
Electron Client → Express Backend (port 5000) → In-Memory Storage
```

### After (Main Backend)
```
Electron Client → Main Backend (port 3000) → PostgreSQL Database
```

## Quick Migration

### Option 1: Update API URL (Recommended)

Simply update the API base URL in the Electron client:

**File:** `manual_proctoring/renderer/js/auth.js`

**Change:**
```javascript
// Before
const APP_CONFIG = {
  apiBaseUrl: 'http://localhost:5000'
}

// After
const APP_CONFIG = {
  apiBaseUrl: 'http://localhost:3000'  // Use main backend
}
```

That's it! The main backend has full compatibility with all the endpoints the Electron client uses.

### Option 2: Use Configuration File

1. Copy the new configuration file:
```bash
cp config/backend-config.js renderer/
```

2. Update `renderer/js/auth.js`:
```javascript
// Before
const APP_CONFIG = {
  apiBaseUrl: 'http://localhost:5000'
}

// After
const { APP_CONFIG } = require('../backend-config.js')
```

3. Update the mode in `config/backend-config.js` to switch between backends.

## Endpoint Compatibility

The main backend provides full compatibility with all Electron client endpoints:

| Electron Endpoint | Main Backend Endpoint | Status |
|------------------|---------------------|---------|
| `POST /api/login` | `POST /api/login` (compatibility layer) | ✅ Compatible |
| `POST /api/logout` | `POST /api/logout` | ✅ Compatible |
| `GET /api/session` | `GET /api/session` | ✅ Compatible |
| `GET /api/student` | `GET /api/student` | ✅ Compatible |
| `GET /api/exam` | `GET /api/exam` | ✅ Compatible |
| `POST /api/exam/start` | `POST /api/exam/start` | ✅ Compatible |
| `POST /api/exam/violations` | `POST /api/exam/violations` | ✅ Compatible |
| `POST /api/exam/submit` | `POST /api/exam/submit` | ✅ Compatible |
| `GET /api/questions` | `GET /api/questions` | ✅ Compatible |

## Benefits of Using Main Backend

### 1. **Database Persistence**
- All exam attempts are stored in PostgreSQL
- Violations are logged and persist across sessions
- User data is centralized

### 2. **Real-time Monitoring**
- Teacher dashboard can monitor manual proctoring sessions
- Live violation alerts via Server-Sent Events
- Centralized logging

### 3. **Authentication**
- JWT-based authentication (same as web client)
- Moodle integration for user management
- Centralized user database

### 4. **Unified Architecture**
- Single backend for all clients (web, mobile, Electron)
- Consistent API across platforms
- Easier maintenance and updates

### 5. **Advanced Features**
- Auto-submit on violation threshold
- Exam timeout handling
- Attempt history and audit logs

## Testing the Migration

### 1. Start the Main Backend

```bash
cd backend
npm run dev
```

The backend should start on port 3000.

### 2. Update Electron Client Configuration

Update `renderer/js/auth.js`:
```javascript
const APP_CONFIG = {
  apiBaseUrl: 'http://localhost:3000'  // Changed from 5000
}
```

### 3. Start the Electron App

```bash
cd manual_proctoring
npm start
```

### 4. Test Login

Use credentials from the seed data:
- Email: `teacher1@example.com` (or any seeded user)
- Password: `password123` (or use the password from seed data)

### 5. Verify Functionality

- ✅ Login works
- ✅ Exam starts
- ✅ Violations are recorded
- ✅ Exam can be submitted
- ✅ Check teacher dashboard for live data

## User Management

### Creating Users

The main backend uses seeded data. To add more users:

```bash
cd backend
npm run seed
```

### Default Users

After seeding, you have these test users:

**Teachers:**
- Email: `teacher1@example.com`
- Username: `teacher1`
- Password: `password123`

**Students:**
- Email: `student1@example.com`
- Username: `student1`
- Password: `password123`

See `backend/scripts/seed.ts` for all available users.

## Troubleshooting

### Issue: "Connection Refused"

**Solution:** Make sure the main backend is running:
```bash
cd backend
npm run dev
```

### Issue: "401 Unauthorized"

**Solution:** Check that you're using seeded user credentials. The main backend requires valid JWT tokens.

### Issue: "No exam found"

**Solution:** Make sure you've run the seed script to create exam data:
```bash
cd backend
npm run seed
```

### Issue: "CORS Error"

**Solution:** The main backend has CORS enabled. Make sure you're accessing from `http://localhost:3000`.

## Deprecating the Dummy Backend

Once you've migrated to the main backend, you can remove the dummy backend:

1. Delete the `manual_proctoring/backend` directory
2. Remove the backend startup from your workflow
3. Update documentation to reference the main backend

## Configuration Options

### Backend URL

If your backend runs on a different port or host:

**File:** `renderer/js/auth.js`
```javascript
const APP_CONFIG = {
  apiBaseUrl: 'http://your-backend-url:port'
}
```

### Environment Variables

You can also use environment variables in `.env`:

```bash
BACKEND_URL=http://localhost:3000
```

Then update `auth.js`:
```javascript
const APP_CONFIG = {
  apiBaseUrl: process.env.BACKEND_URL || 'http://localhost:3000'
}
```

## Next Steps

1. ✅ Switch Electron client to use main backend
2. ✅ Test all functionality
3. ✅ Remove dummy Express backend
4. ✅ Update documentation
5. ✅ Deploy with single backend architecture

## Support

If you encounter issues:

1. Check the backend logs: `cd backend && npm run dev`
2. Check the Electron developer console (F12 in the app)
3. Verify database is running: `docker-compose up postgres`
4. Verify migrations are run: `cd backend && npm run migrate`

## Summary

Migrating to the main backend provides:
- ✅ Single source of truth for all data
- ✅ Real-time monitoring capabilities
- ✅ Database persistence
- ✅ Centralized authentication
- ✅ Unified API architecture

The migration is simple: just update the API base URL from port 5000 to port 3000!
