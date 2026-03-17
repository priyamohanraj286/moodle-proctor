// ─────────────────────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadUrlsResponse {
  uploadId: string;
  urls: string[]; // pre-signed S3 PUT URLs, one per page
}

/**
 * Request pre-signed S3 PUT URLs for the given number of pages.
 * Calls our Next.js API route which validates the session token
 * and generates the signed URLs.
 */
export async function requestUploadUrls(
  sessionToken: string,
  pageCount: number
): Promise<UploadUrlsResponse> {
  const res = await fetch('/api/upload-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken, pageCount }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Notify backend that all pages have been uploaded successfully.
 */
export async function confirmUpload(
  sessionToken: string,
  uploadId: string
): Promise<void> {
  const res = await fetch('/api/confirm-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken, uploadId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
}
