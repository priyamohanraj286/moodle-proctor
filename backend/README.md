# Moodle-Proctor Backend

Unified Fastify + TypeScript backend for the current repo architecture.

## Current Role In The Repo

This is the active backend service for:

- Moodle-backed authentication
- student and exam APIs
- violation recording
- teacher dashboard APIs
- server-sent events for live updates
- WebSocket proxying to the AI proctoring service
- manual proctoring compatibility for the Electron client in `manual_proctoring/`

The legacy Express backend under `manual_proctoring/backend/` is archived and should not be used for normal development.

## Status

- Active and typechecking
- Used by the Electron manual proctoring client
- Intended to be the single backend entrypoint for repo-level integration work

## Run

```bash
cd backend
npm install
npm run dev
```

Default local URL: `http://localhost:5000`

Health check:

```bash
curl http://localhost:5000/health
```

## Core Scripts

```bash
npm run dev
npm run build
npm start
npm run migrate
npm run migrate:status
npm run seed
npm run seed:clear
npm test
```

## Active Backend Modules

- `src/modules/auth/`
- `src/modules/student/`
- `src/modules/exam/`
- `src/modules/violation/`
- `src/modules/teacher/`
- `src/modules/manual-proctoring/`
- `src/modules/security/`
- `src/plugins/websocket-proxy.ts`

## API Surface At A Glance

Authentication:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/validate`
- `POST /api/auth/refresh`

Student/manual client:

- `GET /api/student`
- `GET /api/session`
- `GET /api/exam`
- `GET /api/questions`
- `POST /api/exam/start`
- `POST /api/exam/submit`
- `POST /api/exam/violations`
- `GET /files/:filename`

Teacher/dashboard:

- `GET /api/teacher/exams`
- `GET /api/teacher/exams/:id`
- `GET /api/teacher/attempts`
- `GET /api/teacher/attempts/:id`
- `GET /api/teacher/attempts/:id/violations`
- `GET /api/teacher/students`
- `GET /api/teacher/reports`
- `GET /api/teacher/stats`
- `GET /api/teacher/events`

Real-time:

- `WS /ws/proctor`

## Integration Notes

- `manual_proctoring/` uses this backend at `http://localhost:5000`.
- The manual client identifies itself with the `X-Manual-Proctoring-Client` header.
- AI proctoring runs separately in `ai_proctoring/` and is reached through the backend WebSocket proxy.

## Known Limitations

- Some auth and role-handling paths are still prototype-grade.
- Teacher/dashboard and frontend integration are present, but the wider product is not fully production-hardened.
- The repo still contains historical docs written before the manual backend migration and archive cleanup.
