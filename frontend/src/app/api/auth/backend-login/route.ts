// ============================================================================
// Backend Login Route
// Proxies login requests to the backend API
// ============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json().catch(() => ({}))) as Partial<{
      username: string;
      password: string;
    }>;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing username or password" },
        { status: 400 }
      );
    }

    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      token?: string;
      user?: unknown;
      error?: string;
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Login failed" },
        { status: response.status }
      );
    }

    if (data.success && data.token) {
      // Set JWT token as cookie
      const cookieStore = cookies();
      cookieStore.set("auth_token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return NextResponse.json({
        ok: true,
        user: data.user,
      });
    }

    return NextResponse.json(
      { error: "Invalid response from backend" },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
