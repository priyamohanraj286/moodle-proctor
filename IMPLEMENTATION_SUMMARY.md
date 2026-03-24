# Implementation Summary

## Current State

The repo has moved to a unified-backend shape:

- `backend/` is the active backend
- `manual_proctoring/` is the active Electron client
- `manual_proctoring/backend/server.js` is archived
- `manual_proctoring/backend/server.legacy.js` preserves the old Express demo backend for reference only
- `ai_proctoring/` remains a separate Python service

## Backend Coverage

The Fastify backend includes the following implemented areas:

- authentication routes and services
- student routes and services
- exam routes and services
- violation routes and services
- teacher routes and SSE
- WebSocket proxying to the AI service
- security helpers
- manual-proctoring compatibility routes and in-memory compatibility state

## Manual Proctoring Migration

The Electron app no longer depends on the old local Express backend.

Current flow:

```text
Electron client -> backend/ (Fastify) -> manual compatibility layer
                                   -> AI proctoring service over WebSocket
```

Archived flow:

```text
Electron client -> manual_proctoring/backend/server.legacy.js
```

## Documentation Reality Check

Historically, several docs in this repo described unfinished modules as TODO while other docs described everything as production-ready. That is no longer the intended framing.

The accurate snapshot is:

- major backend modules exist
- the backend now typechecks
- the repo still contains prototype and partially integrated surfaces
- architecture and migration cleanup are still in progress

## Recommended Reading Order

1. `README.md`
2. `STATUS.md`
3. `backend/README.md`
4. `manual_proctoring/README.md`
5. `manual_proctoring/MIGRATION_GUIDE.md`
