# ProctorScan — Mobile Answer Sheet Scanner

A mobile-optimised Next.js 14 web app for scanning and securely uploading student answer sheets to AWS S3. Part of the AI-powered proctoring system.

---

## Architecture Fit

```
Student Desktop App
  └─ Generates QR (short-lived JWT, studentId + examId embedded)
       └─ Student scans QR with phone
            └─ ProctorScan opens (this app)
                 ├─ Validates JWT via Next.js API → Node.js backend
                 ├─ Requests pre-signed S3 PUT URLs
                 ├─ Student scans answer sheet pages (up to 50)
                 ├─ Uploads directly to S3 (proctoring-media bucket)
                 └─ Confirms upload → backend fires WebSocket → Desktop App
```

---

## Features

| Feature | Detail |
|---|---|
| QR Scan | In-app camera scanner (jsQR) + handles `?id=` query param from native camera apps |
| Document Scanner | Live camera with real-time edge detection overlay |
| Auto corner detection | Sobel edge + Otsu threshold → extremal corner finding |
| Perspective correction | Bilinear interpolation homography warp |
| Filters | Original · Greyscale · B&W · Enhance (auto-contrast) |
| Manual corner adjust | Drag corner dots to fine-tune crop |
| Review & reorder | Drag-and-drop grid with dnd-kit (touch-optimised) |
| Delete pages | Tap × on any page in review screen |
| Add more pages | Return to scanner mid-review |
| Direct S3 upload | Parallel upload via pre-signed URLs (max concurrency 3) |
| Progress indicator | Per-page upload progress bar |
| Session persistence | Zustand + localStorage (survives accidental refresh) |
| PWA | Manifest + mobile meta tags for Add to Home Screen |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=proctoring-media
BACKEND_API_URL=http://your-node-backend:4000
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. AWS S3 setup

Your S3 bucket needs a CORS policy to allow PUT uploads from the browser:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": []
  }
]
```

### 4. Run dev server

```bash
npm run dev
```

---

## Integration Points (TODOs for backend team)

### `/src/app/api/upload-urls/route.ts`
Replace the stub token extraction with a real JWT decode + validation call to your Node.js backend:
```ts
// Currently:
const studentId = token.slice(0, 12); // STUB

// Replace with:
const validation = await fetch(`${process.env.BACKEND_API_URL}/api/scan/validate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
const { studentId, examId } = await validation.json();
```

### `/src/app/api/confirm-upload/route.ts`
Uncomment and fill in the backend notification call to trigger the WebSocket event on the Desktop App:
```ts
await fetch(`${process.env.BACKEND_API_URL}/api/scan/complete`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ uploadId }),
});
```

### S3 Key Structure
Pages are stored as:
```
answer-sheets/{studentId}/{uploadId}/page-001.jpg
answer-sheets/{studentId}/{uploadId}/page-002.jpg
...
```

---

## Flow

```
/ (home)
 ├─ QR Scan in-app          → /scan
 └─ ?id=<token> query param → /scan

/scan
 └─ Capture pages (up to 50)
      └─ "Done" → /review

/review
 ├─ Reorder / delete / add more pages
 └─ "Submit" → upload to S3 → /success

/success
 └─ Receipt screen (uploadId, pageCount, timestamp)
```

---

## Mobile UX Notes

- Camera uses `facingMode: environment` (rear camera)
- `perspective correction` is done entirely in-browser via canvas (no server round-trip)
- Filters are applied client-side before upload
- All images compressed to JPEG at 0.92 quality before upload
- Session state persists through page refreshes (Zustand persist)
- `position: fixed` on body prevents iOS bounce/overscroll
