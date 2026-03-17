import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const URL_EXPIRY_SECONDS = 900; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const { token, pageCount } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Missing session token' }, { status: 400 });
    }

    if (!pageCount || pageCount < 1 || pageCount > 50) {
      return NextResponse.json({ message: 'Invalid page count (1-50)' }, { status: 400 });
    }

    // ── Validate JWT with backend ──────────────────────────────────────────
    // TODO: Replace with your actual backend validation call
    // const validation = await validateSessionToken(token);
    // if (!validation.ok) return NextResponse.json({ message: 'Invalid session' }, { status: 401 });
    // const studentId = validation.studentId;
    // const examId = validation.examId;

    // Stub: extract student ID from token (replace with real JWT decode/validate)
    const studentId = token.slice(0, 12); // placeholder
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // ── Generate pre-signed PUT URLs ───────────────────────────────────────
    const urls: string[] = await Promise.all(
      Array.from({ length: pageCount }, async (_, i) => {
        const key = `answer-sheets/${studentId}/${uploadId}/page-${String(i + 1).padStart(3, '0')}.jpg`;
        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: 'image/jpeg',
          // Server-side encryption via KMS (configure your KMS key ARN in AWS console)
          // ServerSideEncryption: 'aws:kms',
        });
        return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });
      })
    );

    return NextResponse.json({ uploadId, urls });
  } catch (err) {
    console.error('[upload-urls] Error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
