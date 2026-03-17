// ─────────────────────────────────────────────────────────────────────────────
// S3 Direct Upload via Pre-signed URLs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a data URL to a Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export interface UploadResult {
  pageIndex: number;
  success: boolean;
  error?: string;
}

/**
 * Uploads a single page to S3 via a pre-signed PUT URL.
 */
async function uploadPage(
  presignedUrl: string,
  dataUrl: string,
  pageIndex: number
): Promise<UploadResult> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });

    if (!res.ok) {
      return { pageIndex, success: false, error: `HTTP ${res.status}` };
    }

    return { pageIndex, success: true };
  } catch (err) {
    return {
      pageIndex,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Uploads all pages to S3 in parallel (with concurrency limit).
 * Calls onProgress(0-100) as pages complete.
 */
export async function uploadAllPages(
  presignedUrls: string[],
  dataUrls: string[],
  onProgress: (percent: number) => void,
  concurrency = 3
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let completed = 0;

  const tasks = dataUrls.map((dataUrl, i) => ({ dataUrl, url: presignedUrls[i], i }));

  // Process in batches
  for (let start = 0; start < tasks.length; start += concurrency) {
    const batch = tasks.slice(start, start + concurrency);
    const batchResults = await Promise.all(
      batch.map(({ url, dataUrl, i }) => uploadPage(url, dataUrl, i))
    );

    results.push(...batchResults);
    completed += batchResults.length;
    onProgress(Math.round((completed / tasks.length) * 100));
  }

  return results;
}
