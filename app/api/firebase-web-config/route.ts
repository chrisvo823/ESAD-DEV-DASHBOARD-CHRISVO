import { NextResponse } from "next/server";
import { readFirebaseWebConfigFromEnv } from "../../../lib/firebase-web-config";

export const dynamic = "force-dynamic";

/**
 * Public Firebase web config for the browser.
 * Values are the standard client SDK keys (restricted by Auth domain / API key).
 */
export async function GET() {
  const config = readFirebaseWebConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      {
        config: null,
        error:
          "Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_* or FIREBASE_WEB_CONFIG.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ config });
}
