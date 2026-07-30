import { NextResponse } from "next/server";
import { listAdminConfigDriveFiles } from "../../../lib/admin-config-drive-files";
import {
  getHostAdminPassword,
  isAuthorizedSiteAdmin,
} from "../../../lib/site-config-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hostPassword = await getHostAdminPassword();
  if (
    !isAuthorizedSiteAdmin(
      request.headers.get("x-esad-admin-password"),
      hostPassword,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const files = await listAdminConfigDriveFiles({
      accessToken: request.headers.get("x-esad-google-access-token"),
    });
    return NextResponse.json({ files });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to list Admin config Drive files.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
