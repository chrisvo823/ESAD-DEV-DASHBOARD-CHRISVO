import { NextResponse } from "next/server";
import { exportAdminConfigDriveFilePlainText } from "../../../../lib/admin-config-drive-files";
import {
  getHostAdminPassword,
  isAuthorizedSiteAdmin,
} from "../../../../lib/site-config-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileId: string }> | { fileId: string };
};

export async function GET(request: Request, context: RouteContext) {
  const hostPassword = await getHostAdminPassword();
  if (
    !isAuthorizedSiteAdmin(
      request.headers.get("x-esad-admin-password"),
      hostPassword,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await context.params;
  const fileId = decodeURIComponent(resolved.fileId ?? "").trim();
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id." }, { status: 400 });
  }

  try {
    const text = await exportAdminConfigDriveFilePlainText(fileId, {
      accessToken: request.headers.get("x-esad-google-access-token"),
    });
    return NextResponse.json({ text });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to export Admin config Drive file.";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status)
        : 500;
    return NextResponse.json(
      { error: message },
      { status: status === 401 || status === 403 ? status : 500 },
    );
  }
}
