# Project Status

**Last updated:** 2026-03-24

## Current Architecture

This repository contains multiple related prototypes, but the active backend architecture is now centered on the unified Fastify service in `backend/`.

- `backend/`: active API backend for auth, exam flows, violations, teacher data, SSE, WebSocket proxying, and manual-proctoring compatibility
- `manual_proctoring/`: active Electron desktop client that talks to `backend/`
- `manual_proctoring/backend/server.js`: archived guard stub
- `manual_proctoring/backend/server.legacy.js`: preserved legacy Express demo backend for reference only
- `ai_proctoring/`: separate Python AI service used by the backend WebSocket proxy
- `frontend/`: Next.js teacher dashboard prototype
- `Scanning-and-Uploading/exam-system-mobile-client-main/`: mobile scanning/upload client prototype

## What Works Now

- The TypeScript backend in `backend/` builds with `npx tsc --noEmit`.
- The backend exposes auth, student, exam, violation, teacher, SSE, WebSocket, and manual-compatibility routes.
- The Electron manual proctoring client is configured to use `http://localhost:5000`.
- The legacy manual backend has been clearly archived to avoid split-brain runtime confusion.

## Current Caveats

- The repository is still a workspace of partially integrated apps rather than one polished end-to-end product.
- Some documentation outside this file may still describe aspirational or prototype behavior.
- The frontend and mobile client are not fully integrated with production-grade auth and backend flows.
- Several backend areas still carry prototype-level implementation choices, especially around role handling and parts of the manual compatibility layer.

## Recommended Next Focus

1. Keep docs aligned with the unified backend architecture.
2. Validate the Electron manual client against the Fastify compatibility routes end to end.
3. Tighten backend auth and role enforcement where routes still use provisional patterns.
4. Decide which prototypes are meant to remain active and which should be archived.
