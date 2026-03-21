# 📹 Manual Proctoring Electron Application

A desktop application for manual proctoring of online exams, built with Electron.

## 🎯 Overview

This Electron app allows teachers to manually proctor students taking exams. It connects to the main backend API for authentication, exam management, and violation logging.

## 🏗️ Architecture

```
┌─────────────────┐
│  Electron App   │
│  (Manual        │
│   Proctoring)   │
└────────┬────────┘
         │ HTTP/WebSocket
         ▼
┌─────────────────┐
│  Main Backend   │
│  (Port 3000)    │
│  - Fastify      │
│  - PostgreSQL   │
│  - JWT Auth     │
└─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **Main Backend Running**
   ```bash
   cd backend
   npm install
   npm run migrate
   npm run seed
   npm run dev
   ```

2. **Database Running**
   ```bash
   docker-compose up -d postgres
   ```

### Install & Run

1. **Install dependencies**
   ```bash
   cd manual_proctoring
   npm install
   ```

2. **Configure Backend URL**

   Edit `renderer/js/auth.js` and set:
   ```javascript
   const APP_CONFIG = {
     apiBaseUrl: 'http://localhost:3000'  // Main backend
   }
   ```

3. **Start Electron**
   ```bash
   npm start
   ```

### Login Credentials

Use seeded test users (from `backend/scripts/seed.ts`):

**Teacher Account:**
- Email: `teacher1@example.com`
- Username: `teacher1`
- Password: `password123`

**Student Account:**
- Email: `student1@example.com`
- Username: `student1`
- Password: `password123`

## 📂 Project Structure

```
manual_proctoring/
├── main.js                 # Electron main process
├── preload.js              # Preload script (IPC bridge)
├── package.json            # Dependencies
├── config/
│   └── backend-config.js   # Backend configuration
└── renderer/
    ├── login.html          # Login page
    ├── dashboard.html      # Dashboard
    ├── exam.html           # Exam monitoring
    ├── css/
    │   └── style.css       # Styles
    └── js/
        ├── auth.js         # Authentication & API client
        ├── login.js        # Login logic
        ├── dashboard.js    # Dashboard logic
        └── exam.js         # Exam monitoring logic
```

## 🔧 Configuration

### Backend Configuration

**File:** `renderer/js/auth.js`

```javascript
const APP_CONFIG = {
  apiBaseUrl: 'http://localhost:3000'  // Main backend URL
};
```

### Environment Variables

Create a `.env` file in the manual_proctoring directory:

```bash
BACKEND_URL=http://localhost:3000
NODE_ENV=development
```

## 🔌 API Integration

The Electron client connects to the main backend using these endpoints:

### Authentication
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/session` - Get current session

### Exam Management
- `GET /api/student` - Get student profile
- `GET /api/exam` - Get exam details
- `POST /api/exam/start` - Start exam
- `POST /api/exam/submit` - Submit exam

### Violations
- `POST /api/exam/violations` - Report violation

### Questions
- `GET /api/questions` - Get exam questions

## 🎨 Features

### Student Dashboard
- View assigned exams
- Start/Resume exams
- Real-time timer
- Violation tracking

### Exam Interface
- Fullscreen mode
- Question display
- Violation reporting (manual)
- Submit exam
- Warning count display

### Violation Types
- Face not visible
- Multiple people detected
- Phone detected
- Looking away
- Background noise

## 🔄 Migration from Dummy Backend

**Previously**, this app used a dummy Express backend on port 5000.

**Now**, it connects directly to the main backend on port 3000.

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions.

**Quick Migration:**

Simply update the API URL in `renderer/js/auth.js`:
```javascript
// Before
apiBaseUrl: 'http://localhost:5000'

// After
apiBaseUrl: 'http://localhost:3000'
```

## 🐛 Troubleshooting

### "Connection Refused"
- Make sure the main backend is running on port 3000
- Check firewall settings

### "401 Unauthorized"
- Verify you're using seeded user credentials
- Check that the database has been seeded: `cd backend && npm run seed`

### "No exam found"
- Ensure seed data has been loaded
- Check database connection

### App won't start
- Clear Electron cache: `rm -rf ~/.config/electron`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## 📦 Dependencies

- `electron` - Desktop app framework
- `axios` - HTTP client (via CDN in renderer)

## 🔐 Security

- JWT-based authentication
- HttpOnly cookies for token storage
- CORS enabled for localhost
- Automatic token refresh

## 🚀 Deployment

### Building for Production

```bash
npm install --save-dev electron-builder
```

Update `package.json`:
```json
{
  "build": {
    "appId": "com.proctoring.manual",
    "productName": "Manual Proctoring",
    "directories": {
      "output": "dist"
    }
  }
}
```

Build:
```bash
npm run build
```

### Distribution

- **Windows:** `.exe` installer
- **macOS:** `.dmg` file
- **Linux:** `.AppImage`

## 📝 Development Workflow

1. Start backend:
   ```bash
   cd backend && npm run dev
   ```

2. Start Electron:
   ```bash
   cd manual_proctoring && npm start
   ```

3. Open DevTools:
   - Press `F12` or `Ctrl+Shift+I` (Linux/Windows)
   - Press `Cmd+Option+I` (macOS)

## 🔗 Related Documentation

- [Backend README](../backend/README.md)
- [Frontend Integration Guide](../frontend/FRONTEND_INTEGRATION.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Main README](../README.md)

## 🎓 Learning Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Fastify Backend](../backend/)
- [API Endpoints](../backend/README.md#api-endpoints)

## 📄 License

[Your License Here]

---

**Note:** This application is part of the Moodle Proctor ecosystem. See the main [README](../README.md) for complete system documentation.
