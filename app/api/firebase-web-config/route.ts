import { NextResponse } from "next/server";
import { readFirebaseWebConfigFromEnv } from "../../../lib/firebase-web-config";

export const dynamic = "force-dynamic";

/**
 * Public Firebase web config for the browser.
 * Values are the standard client SDK keys (restricted by Auth domain / API key).
 */
export async function GET() {
  const config = readFirebaseWebConfigFromEnv();
  // 200 with null config — missing Firebase is a normal preview state, not a
  // server failure (avoids noisy browser console 503s).
  if (!config) {
    return NextResponse.json({
      config: null,
      error:
        "Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_* or FIREBASE_WEB_CONFIG.",
    });
  }
  return NextResponse.json({ config });
}
