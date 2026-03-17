import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token, uploadId } = await req.json();

    if (!token || !uploadId) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    // ── Notify backend that upload is complete ─────────────────────────────
    // This triggers the UPLOAD_PENDING state change on the desktop app
    // via WebSocket. Replace with your actual backend API call.
    //
    // await fetch(`${process.env.BACKEND_API_URL}/api/scan/complete`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({ uploadId }),
    // });

    console.log(`[confirm-upload] Upload complete: ${uploadId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[confirm-upload] Error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
