# Frontend Integration Guide

This guide explains how to integrate the frontend with the backend API.

## Overview

The frontend is a Next.js application that connects to the backend REST API and uses Server-Sent Events (SSE) for real-time updates.

## Setup

### 1. Environment Variables

Create a `.env.local` file in the frontend directory:

```bash
cp .env.example .env.local
```

Update the backend URL:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

### 2. Install Dependencies

The frontend uses standard React hooks. No additional dependencies are needed beyond what's already in `package.json`.

## API Client

The backend API client is located in `src/lib/backend.ts`:

```typescript
import { backendAPI } from '@/lib/backend';

// Login
const response = await backendAPI.login(username, password);
const token = response.data.token;
const user = response.data.user;

// Get stats
const stats = await backendAPI.getStats({ timeRange: 'hour' });

// Get attempts
const attempts = await backendAPI.getAttempts({ status: 'in_progress' });

// Get students
const students = await backendAPI.getStudents({ search: 'John' });
```

## Authentication

### Using the Auth Provider

Wrap your app with the `AuthProvider`:

```typescript
// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Using Auth in Components

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  return (
    <div>
      <p>Welcome, {user?.firstName}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Data Fetching Hooks

Custom hooks for data fetching are in `src/hooks/useTeacherData.ts`:

### useTeacherStats

```typescript
import { useTeacherStats } from '@/hooks/useTeacherData';

function Dashboard() {
  const { stats, isLoading, error, refetch } = useTeacherStats();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Total Exams: {stats?.overview.totalExams}</h3>
      <h3>Active Attempts: {stats?.overview.activeAttempts}</h3>
    </div>
  );
}
```

### useAttempts

```typescript
import { useAttempts } from '@/hooks/useTeacherData';

function AttemptsList() {
  const { attempts, total, isLoading, refetch } = useAttempts({
    status: 'in_progress',
    limit: 20,
  });

  return (
    <div>
      <p>Total: {total}</p>
      {attempts.map(attempt => (
        <div key={attempt.id}>{attempt.examName}</div>
      ))}
    </div>
  );
}
```

### useStudents

```typescript
import { useStudents } from '@/hooks/useTeacherData';

function StudentsList() {
  const { students, isLoading, refetch } = useStudents({
    search: 'John',
    limit: 10,
  });

  return (
    <ul>
      {students.map(student => (
        <li key={student.id}>{student.firstName} {student.lastName}</li>
      ))}
    </ul>
  );
}
```

### useReports

```typescript
import { useReports } from '@/hooks/useTeacherData';

function ReportsList() {
  const { reports, isLoading } = useReports({
    examId: 1,
    minViolations: 3,
  });

  return (
    <table>
      {reports.map(report => (
        <tr key={report.attemptId}>
          <td>{report.studentName}</td>
          <td>{report.examName}</td>
          <td>{report.violationCount}</td>
        </tr>
      ))}
    </table>
  );
}
```

### useExams

```typescript
import { useExams } from '@/hooks/useTeacherData';

function ExamsList() {
  const { exams, isLoading } = useExams();

  return (
    <ul>
      {exams.map(exam => (
        <li key={exam.id}>
          {exam.examName} ({exam.courseName})
        </li>
      ))}
    </ul>
  );
}
```

## Real-time Updates with SSE

### useSSE Hook

Connect to Server-Sent Events for real-time updates:

```typescript
import { useSSE } from '@/hooks/useSSE';

function LiveMonitoring() {
  const { isConnected, events, lastEvent } = useSSE({
    examId: 123, // Optional: filter by exam
  });

  useEffect(() => {
    if (lastEvent?.type === 'violation') {
      console.log('New violation:', lastEvent.data);
      // Show notification, update UI, etc.
    }
  }, [lastEvent]);

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Events received: {events.length}</p>
    </div>
  );
}
```

### Auto-refresh on Events

Automatically refresh data when SSE events are received:

```typescript
import { useAttempts } from '@/hooks/useTeacherData';
import { useAutoRefresh } from '@/hooks/useSSE';

function AutoRefreshingAttempts() {
  const { attempts, refetch } = useAttempts({ status: 'in_progress' });

  // Auto-refresh when exam_start or exam_end events are received
  useAutoRefresh(true, refetch, ['exam_start', 'exam_end']);

  return (
    <div>
      {attempts.map(attempt => (
        <div key={attempt.id}>{attempt.examName}</div>
      ))}
    </div>
  );
}
```

## Migration from Mock Data

To migrate from mock data to real API:

### 1. Replace mock imports

**Before:**
```typescript
import { monitoringStudents } from "@mock/data";
```

**After:**
```typescript
import { useAttempts } from '@/hooks/useTeacherData';
```

### 2. Use hooks instead of static data

**Before:**
```typescript
export const StudentsGrid = () => {
  return (
    <div>
      {monitoringStudents.map(student => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  );
};
```

**After:**
```typescript
export const StudentsGrid = () => {
  const { attempts, isLoading, error, refetch } = useAttempts({
    status: 'in_progress',
  });

  const { isConnected } = useSSE();
  useAutoRefresh(true, refetch, ['exam_start', 'exam_end']);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const students = attempts.map(attempt => ({
    id: attempt.id.toString(),
    name: `${attempt.firstName} ${attempt.lastName}`,
    exam: attempt.examName,
    status: attempt.violationCount > 5 ? 'suspicious' : 'normal',
  }));

  return (
    <div>
      {students.map(student => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  );
};
```

## Component Examples

### Example: Dashboard Page with Real Data

```typescript
// src/app/dashboard/page.tsx
'use client';

import { useTeacherStats } from '@/hooks/useTeacherData';
import { StudentsGridReal } from '@/components/StudentsGrid.real';

export default function DashboardOverviewPage() {
  const { stats, isLoading } = useTeacherStats();

  if (isLoading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stats Overview */}
      <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold mb-4">Overview</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-gray-600">Total Exams</p>
            <p className="text-2xl font-bold">{stats?.overview.totalExams || 0}</p>
          </div>
          <div>
            <p className="text-gray-600">Active Attempts</p>
            <p className="text-2xl font-bold">{stats?.overview.activeAttempts || 0}</p>
          </div>
          <div>
            <p className="text-gray-600">Total Violations</p>
            <p className="text-2xl font-bold">{stats?.violations.total || 0}</p>
          </div>
          <div>
            <p className="text-gray-600">Active Students</p>
            <p className="text-2xl font-bold">{stats?.students.active || 0}</p>
          </div>
        </div>
      </div>

      {/* Live Monitoring */}
      <div className="lg:col-span-3">
        <StudentsGridReal />
      </div>
    </div>
  );
}
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/me` - Get current user

### Teacher Endpoints

- `GET /api/teacher/exams` - List all exams
- `GET /api/teacher/exams/:id` - Get exam details
- `GET /api/teacher/attempts` - List attempts with filters
- `GET /api/teacher/attempts/:id` - Get attempt details
- `GET /api/teacher/attempts/:id/violations` - Get attempt violations
- `GET /api/teacher/students` - List students
- `GET /api/teacher/reports` - Generate reports
- `GET /api/teacher/stats` - Dashboard statistics

### SSE Endpoint

- `GET /api/teacher/events` - Server-Sent Events stream

## Type Safety

TypeScript types are exported from the backend and can be used in the frontend:

```typescript
import type { TeacherAttempt, TeacherStats } from '@/types/backend';

function processAttempt(attempt: TeacherAttempt) {
  console.log(`${attempt.username} - ${attempt.examName}`);
}
```

## Error Handling

All API calls throw errors on failure. Use try-catch or error states:

```typescript
const { data, error, isLoading } = useAttempts({ status: 'in_progress' });

if (error) {
  return <ErrorDisplay message={error.message} />;
}

if (isLoading) {
  return <LoadingSpinner />;
}
```

## Testing

To test the integration without a real backend, you can use the existing mock data:

```typescript
// In development, use mock data
const USE_MOCK = process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_BACKEND_URL;

import { monitoringStudents } from '@mock/data';
import { useAttempts } from '@/hooks/useTeacherData';

function StudentsGrid() {
  if (USE_MOCK) {
    return (
      <div>
        {monitoringStudents.map(student => (
          <StudentCard key={student.id} student={student} />
        ))}
      </div>
    );
  }

  const { attempts, isLoading } = useAttempts({ status: 'in_progress' });
  // ... real implementation
}
```

## Next Steps

1. Add `AuthProvider` to `app/layout.tsx`
2. Update each dashboard page to use the hooks
3. Replace mock data imports with real API calls
4. Add loading and error states
5. Implement SSE for live updates
6. Add authentication guard to protected routes
7. Test with the backend running
