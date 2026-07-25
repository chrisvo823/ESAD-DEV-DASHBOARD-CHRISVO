const SMARTSHEET_API_BASE = "https://api.smartsheet.com/2.0";

export type SmartsheetUser = {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
};

export type SmartsheetSheetSummary = {
  id: number;
  name: string;
  accessLevel?: string;
  permalink?: string;
  createdAt?: string;
  modifiedAt?: string;
};

export type SmartsheetConnection = {
  user: SmartsheetUser;
  sheetCount: number;
  sheets: SmartsheetSheetSummary[];
};

function getAccessToken(
  token: string | undefined = process.env.SMARTSHEET_ACCESS_TOKEN,
): string {
  const trimmed = token?.trim();
  if (!trimmed) {
    throw new Error(
      "SMARTSHEET_ACCESS_TOKEN is not set. Add it to your environment or .env file.",
    );
  }
  return trimmed;
}

function resolveAccessToken(token?: string): string {
  if (token?.trim()) return token.trim();

  const fromProcess = process.env.SMARTSHEET_ACCESS_TOKEN?.trim();
  if (fromProcess) return fromProcess;

  // Cloudflare Workers expose bindings via the global env in some runtimes;
  // vinext/miniflare also mirrors configured vars onto process.env.
  const fromGlobal = (globalThis as { SMARTSHEET_ACCESS_TOKEN?: string })
    .SMARTSHEET_ACCESS_TOKEN;
  return getAccessToken(fromGlobal);
}

async function smartsheetFetch<T>(
  path: string,
  token?: string,
): Promise<T> {
  const accessToken = resolveAccessToken(token);
  const response = await fetch(`${SMARTSHEET_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Smartsheet API ${path} failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getSmartsheetCurrentUser(
  token?: string,
): Promise<SmartsheetUser> {
  return smartsheetFetch<SmartsheetUser>("/users/me", token);
}

export async function listSmartsheetSheets(
  token?: string,
): Promise<SmartsheetSheetSummary[]> {
  const payload = await smartsheetFetch<{ data: SmartsheetSheetSummary[] }>(
    "/sheets?includeAll=true",
    token,
  );
  return payload.data ?? [];
}

export async function getSmartsheetSheet(
  sheetId: number | string,
  token?: string,
): Promise<Record<string, unknown>> {
  return smartsheetFetch<Record<string, unknown>>(`/sheets/${sheetId}`, token);
}

/** Verify API credentials and return a short connection summary. */
export async function connectSmartsheet(
  token?: string,
): Promise<SmartsheetConnection> {
  const [user, sheets] = await Promise.all([
    getSmartsheetCurrentUser(token),
    listSmartsheetSheets(token),
  ]);

  return {
    user,
    sheetCount: sheets.length,
    sheets,
  };
}
