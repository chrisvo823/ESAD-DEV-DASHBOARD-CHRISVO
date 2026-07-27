import { NextResponse } from "next/server";
import type { SiteConfigPatch } from "../../../lib/site-config";
import {
  getHostAdminPassword,
  getPublicSiteConfig,
  isAuthorizedSiteAdmin,
  updateSiteAdminConfig,
} from "../../../lib/site-config-store";
import { toPublicSiteConfig } from "../../../lib/site-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getPublicSiteConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const hostPassword = await getHostAdminPassword();
  if (
    !isAuthorizedSiteAdmin(
      request.headers.get("x-esad-admin-password"),
      hostPassword,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid patch body" }, { status: 400 });
  }

  const patch = body as SiteConfigPatch;
  const updated = await updateSiteAdminConfig(patch);
  return NextResponse.json(toPublicSiteConfig(updated));
}
