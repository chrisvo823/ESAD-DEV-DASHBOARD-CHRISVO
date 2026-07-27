import { NextResponse } from "next/server";
import { getAdminCredentials } from "../../../lib/dashboard-config";
import {
  changeHostAdminPassword,
  getHostAdminPassword,
  isAuthorizedSiteAdmin,
  loadSiteAdminConfig,
  resetHostAdminPassword,
  updateSiteAdminConfig,
  verifyAdminLogin,
} from "../../../lib/site-config-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = await loadSiteAdminConfig();
  const hostPassword = config.adminCredentials.password;
  const authorized = isAuthorizedSiteAdmin(
    request.headers.get("x-esad-admin-password"),
    hostPassword,
  );

  return NextResponse.json({
    username: getAdminCredentials().username,
    recoveryEmail: config.adminCredentials.recoveryEmail,
    // Never return the password. Authorized callers already know it.
    authorized,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body as { action?: unknown }).action;
  if (typeof action !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  if (action === "verify") {
    const username =
      typeof (body as { username?: unknown }).username === "string"
        ? (body as { username: string }).username
        : "";
    const password =
      typeof (body as { password?: unknown }).password === "string"
        ? (body as { password: string }).password
        : "";
    const ok = await verifyAdminLogin(username, password);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, {
        status: 401,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "change") {
    const hostPassword = await getHostAdminPassword();
    if (
      !isAuthorizedSiteAdmin(
        request.headers.get("x-esad-admin-password"),
        hostPassword,
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentPassword =
      typeof (body as { currentPassword?: unknown }).currentPassword === "string"
        ? (body as { currentPassword: string }).currentPassword
        : "";
    const nextPassword =
      typeof (body as { nextPassword?: unknown }).nextPassword === "string"
        ? (body as { nextPassword: string }).nextPassword
        : "";

    const result = await changeHostAdminPassword({
      currentPassword,
      nextPassword,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    const email =
      typeof (body as { email?: unknown }).email === "string"
        ? (body as { email: string }).email
        : "";
    const nextPassword =
      typeof (body as { nextPassword?: unknown }).nextPassword === "string"
        ? (body as { nextPassword: string }).nextPassword
        : "";
    const result = await resetHostAdminPassword({ email, nextPassword });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      recoveryEmail: result.recoveryEmail,
    });
  }

  if (action === "update-recovery") {
    const hostPassword = await getHostAdminPassword();
    if (
      !isAuthorizedSiteAdmin(
        request.headers.get("x-esad-admin-password"),
        hostPassword,
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const recoveryEmail =
      typeof (body as { recoveryEmail?: unknown }).recoveryEmail === "string"
        ? (body as { recoveryEmail: string }).recoveryEmail.trim()
        : "";
    await updateSiteAdminConfig({
      adminCredentials: { recoveryEmail },
    });
    return NextResponse.json({ ok: true, recoveryEmail });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
