# ProctorScan Project Overview

## Purpose
ProctorScan is a mobile-optimized Next.js web app used by students to scan answer sheets with a phone camera and upload them to AWS S3. It is part of a broader AI-powered proctoring system and integrates with a separate Node.js backend and a desktop proctoring app.

## High-Level Flow
1. Desktop app generates a short-lived QR (JWT containing studentId + examId).
2. Student scans QR with phone; ProctorScan opens at /scan.
3. ProctorScan validates the token via the backend and requests pre-signed S3 PUT URLs.
4. Student scans up to 50 pages, reviews and reorders them.
5. Images upload directly to S3 using the pre-signed URLs.
6. ProctorScan confirms upload to backend; backend notifies desktop app via WebSocket.

## User Journey
- / (home)
  - Scan QR in-app or open with ?id=<token> query
- /scan
  - Capture pages, apply auto-crop and filters, then "Done" to review
- /review
  - Reorder, delete, add pages; "Submit" to upload
- /success
  - Receipt screen (uploadId, pageCount, timestamp)

## Core Features
- QR scanning (jsQR) with support for ?id= query param.
- Live document scanning with edge detection overlay.
- Auto corner detection and perspective correction in-browser.
- Filters: Original, Greyscale, B&W, Enhance.
- Manual corner adjustment for crops.
- Review grid with drag-and-drop reordering (dnd-kit).
- Direct S3 upload using pre-signed URLs with per-page progress.
- Session persistence using Zustand + localStorage.
- PWA support via manifest and mobile meta tags.

## Architecture and Integration Points
### Token Validation
- ProctorScan expects a short-lived JWT token from the desktop app QR.
- In /src/app/api/upload-urls/route.ts, token validation is currently stubbed and must be replaced with a real backend call.

### S3 Upload
- Uploads go directly to S3 using pre-signed PUT URLs from the backend.
- Pages are stored with this key structure:
  - answer-sheets/{studentId}/{uploadId}/page-001.jpg

### Upload Confirmation
- /src/app/api/confirm-upload/route.ts must call the backend to trigger a WebSocket event to the desktop app after upload.

## Technology Stack
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Zustand for state management
- dnd-kit for drag-and-drop
- jsQR for QR detection
- AWS SDK v3 for S3 presigned URL flow

## Environment Variables
Set in .env.local:
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- S3_BUCKET_NAME
- BACKEND_API_URL
- NEXT_PUBLIC_APP_URL

## AWS S3 CORS Requirements
The S3 bucket must allow PUT from the app domain. Example policy:

[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": []
  }
]

## Testing Notes
### Functional Areas
- QR scan to open /scan
- Camera capture, auto-crop, manual corner adjustment
- Filters and image output quality
- Review grid reorder and delete
- Add pages mid-review
- Upload concurrency (max 3), progress bars, retry behavior
- Session persistence across refresh
- Success screen content

### Integration Tests
- Token validation against backend endpoint
- Pre-signed URL generation and S3 upload
- Upload confirmation API call triggers backend event

### Mobile Coverage
- iOS Safari and Chrome (iPhone)
- Android Chrome
- Camera permissions flow
- Orientation changes and on-screen keyboard behavior

## Local Development
- npm install
- npm run dev

## Known TODOs for Integration Team
- Implement token validation in /src/app/api/upload-urls/route.ts.
- Implement confirmation call in /src/app/api/confirm-upload/route.ts.
- Ensure BACKEND_API_URL endpoints exist:
  - POST /api/scan/validate
  - POST /api/scan/complete
