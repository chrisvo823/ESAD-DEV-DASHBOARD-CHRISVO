import { NextResponse } from "next/server";
import { getAdminCredentials } from "../../../lib/dashboard-config";
import {
  summarizeLoginActivity,
} from "../../../lib/login-activity";
import {
  listLoginActivity,
  recordLoginActivity,
} from "../../../lib/login-activity-store";

export const dynamic = "force-dynamic";

function isAuthorizedAdmin(request: Request): boolean {
  const provided = request.headers.get("x-esad-admin-password")?.trim() ?? "";
  if (!provided) return false;
  const { password } = getAdminCredentials();
  return provided === password;
}

export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await listLoginActivity();
  return NextResponse.json(summarizeLoginActivity(events));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email
      : "";

  const event = await recordLoginActivity(email);
  if (!event) {
    return NextResponse.json(
      { error: "Email must be an allowed company address" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, event }, { status: 201 });
}
