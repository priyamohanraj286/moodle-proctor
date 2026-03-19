# DSC Project Workspace

This repository is a workspace for multiple exam and proctoring prototypes. It includes:

- a browser-based teacher dashboard
- a desktop-based manual proctoring app
- an AI proctoring backend with computer vision detectors
- a mobile answer-sheet scanning client

Each folder is currently developed and run independently. There is no single root install or unified start command yet.

## Repository Structure

### `dsc/`

Next.js teacher dashboard UI for monitoring students, alerts, reports, and settings.

- Stack: Next.js 14, React 18, TypeScript, Tailwind CSS
- Status: front-end focused prototype
- Login behavior: the login page is currently UI-only and accepts any email/password

### `manual_proctoring/`

Electron desktop app for candidate login, exam flow, and local/manual proctoring interactions.

- Stack: Electron, vanilla HTML/CSS/JS
- Includes: `backend/` Express API used by the Electron app
- Demo login:
  - Email: `user`
  - Password: `password`

### `ai_proctoring/`

Python-based AI proctoring service that processes webcam frames over WebSocket and returns violations/advisories in real time.

- Stack: FastAPI, OpenCV, MediaPipe, Ultralytics YOLO
- Entry point: `ai_proctoring/main.py`
- Default service URL: `http://localhost:8000`
- Health endpoint: `GET /health`
- WebSocket endpoints:
  - `/proctor`
  - `/ws/proctor`

Available detectors are controlled from `ai_proctoring/config.py` and currently include face monitoring, gaze tracking, phone detection, object detection, and identity verification by default. Additional modules such as audio, blink, lip, tab, lighting, and motion monitoring are present but disabled by default.

### `Scanning-and-Uploading/exam-system-mobile-client-main/`

Next.js mobile web app for scanning and uploading answer sheets.

- Stack: Next.js 14, React, TypeScript, Tailwind CSS
- Includes QR scanning, page review/reordering, and S3 upload flow
- Status: partially integrated prototype with backend/S3 setup still required

## Prerequisites

Install the tools needed for the part of the workspace you want to run:

- Node.js 18+ and npm
- Python 3.10+ for `ai_proctoring`
- Windows is recommended for the current manual proctoring and tab-monitoring flow
- A webcam is required for camera-based proctoring features

## Quick Start

### 1. Teacher dashboard (`dsc`)

```bash
cd dsc
npm install
npm run dev
```

Open `http://localhost:3000`.

Notes:

- `/` redirects to `/login`
- the current login flow does not validate credentials

### 2. Manual proctoring desktop app (`manual_proctoring`)

Run this in two terminals.

Terminal 1:

```bash
cd manual_proctoring/backend
npm install
npm start
```

Backend runs at `http://localhost:5000`.

Terminal 2:

```bash
cd manual_proctoring
npm install
npm start
```

The Electron app will open and use the backend above.

Demo credentials:

- Email: `user`
- Password: `password`

### 3. AI proctoring service (`ai_proctoring`)

```bash
cd ai_proctoring
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The FastAPI service starts on `http://localhost:8000`.

Notes:

- this service expects frame data over WebSocket rather than reading directly from `cv2.VideoCapture`
- most behavior is configured centrally in `ai_proctoring/config.py`
- models such as `yolov8n.pt`, `blaze_face_short_range.tflite`, and `face_landmarker.task` are already included in the folder
- report generation runs on shutdown

### 4. Mobile scanning client (`Scanning-and-Uploading/exam-system-mobile-client-main`)

```bash
cd Scanning-and-Uploading/exam-system-mobile-client-main
npm install
npm run dev
```

Open the local URL shown by Next.js in a mobile browser or device emulator.

Important:

- this app expects environment variables and AWS S3 configuration for full upload support
- some backend integration points are still marked as TODOs inside the app

## Runtime Outputs

Some projects create runtime artifacts while running:

- `manual_proctoring/backend/logs/` stores backend warning logs
- `ai_proctoring` can generate violation logs, screenshots, and PDF reports depending on configuration
- generated build artifacts such as `.next`, `node_modules`, and Python cache folders are not source files

## Current Integration State

This repository contains related parts of a larger proctoring system, but they are not fully wired together end to end yet.

- `dsc` is primarily a dashboard UI prototype
- `manual_proctoring` is a working desktop demo backed by a local Express server
- `ai_proctoring` is a standalone real-time detection service
- the mobile scanning app still needs production backend and storage integration

## Useful Entry Points

- `dsc/src/app/login/page.tsx`
- `dsc/src/app/dashboard/page.tsx`
- `manual_proctoring/main.js`
- `manual_proctoring/backend/server.js`
- `ai_proctoring/main.py`
- `ai_proctoring/config.py`
- `Scanning-and-Uploading/exam-system-mobile-client-main/src/app/page.tsx`
