import { NextResponse } from "next/server";
import type { SiteConfigPatch } from "../../../lib/site-config";
import {
  getDashboardConfigGoogleDocUrl,
  getHostAdminPassword,
  getPublicSiteConfig,
  isAuthorizedSiteAdmin,
  updateSiteAdminConfig,
} from "../../../lib/site-config-store";
import { toPublicSiteConfig } from "../../../lib/site-config";

export const dynamic = "force-dynamic";

function readGoogleAccessToken(request: Request): string | null {
  return request.headers.get("x-esad-google-access-token");
}

export async function GET(request: Request) {
  const config = await getPublicSiteConfig({
    googleAccessToken: readGoogleAccessToken(request),
    // Keep all users' live Hero in sync with the Google Doc on each pull.
    forceGoogleDocRefresh: true,
  });
  return NextResponse.json({
    ...config,
    googleDocUrl: getDashboardConfigGoogleDocUrl(),
    dashboardConfigSource: "google-doc",
  });
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
  try {
    const updated = await updateSiteAdminConfig(patch, {
      googleAccessToken: readGoogleAccessToken(request),
    });
    return NextResponse.json({
      ...toPublicSiteConfig(updated),
      googleDocUrl: getDashboardConfigGoogleDocUrl(),
      googleDocWritten: Boolean(patch.programConfig),
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to save Dashboard Configuration to the Google Doc.";
    return NextResponse.json(
      {
        error: message,
        googleDocUrl: getDashboardConfigGoogleDocUrl(),
        googleDocWritten: false,
      },
      { status: 500 },
    );
  }
}
