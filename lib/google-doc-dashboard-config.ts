import { createSign } from "node:crypto";
import {
  formatProgramConfigText,
  parseProgramConfigText,
  type ProgramConfig,
} from "./program-config";
import { sanitizeProgramConfig } from "./site-config";

/** Shared Google Doc that stores Dashboard Configuration for every user. */
export const DASHBOARD_CONFIG_GOOGLE_DOC_ID =
  "15XbbNYYGVMyxCgQs6MaQAO-cMLJTyRcF_67F0dmc-vA";

export const DASHBOARD_CONFIG_GOOGLE_DOC_URL =
  `https://docs.google.com/document/d/${DASHBOARD_CONFIG_GOOGLE_DOC_ID}/edit?tab=t.0`;

const DOCS_API_BASE = "https://docs.googleapis.com/v1";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DOCS_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type GoogleDocsTextRun = { content?: string };
type GoogleDocsParagraphElement = { textRun?: GoogleDocsTextRun };
type GoogleDocsStructuralElement = {
  endIndex?: number;
  paragraph?: { elements?: GoogleDocsParagraphElement[] };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleDocsStructuralElement[];
      }>;
    }>;
  };
};

type GoogleDocsDocument = {
  body?: {
    content?: GoogleDocsStructuralElement[];
  };
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

const GLOBAL_TOKEN_KEY = "__esadGoogleDocsAccessToken__";

type GlobalTokenStore = typeof globalThis & {
  [GLOBAL_TOKEN_KEY]?: TokenCache;
};

function readEnvValue(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  const fromGlobal = (globalThis as Record<string, unknown>)[key];
  return typeof fromGlobal === "string" && fromGlobal.trim()
    ? fromGlobal.trim()
    : undefined;
}

function parseServiceAccountJson(
  raw: string | undefined,
): ServiceAccountJson | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (
      typeof parsed.client_email === "string" &&
      typeof parsed.private_key === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function mintServiceAccountAccessToken(
  account: ServiceAccountJson,
): Promise<TokenCache> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: account.client_email,
      scope: DOCS_SCOPES,
      aud: account.token_uri?.trim() || OAUTH_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const unsigned = `${header}.${claimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const privateKey = (account.private_key ?? "").replace(/\\n/g, "\n");
  const signature = base64UrlEncode(signer.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(account.token_uri?.trim() || OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google service-account token exchange failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) {
    throw new Error("Google service-account token response missing access_token.");
  }
  const expiresInSec =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 3600;
  return {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000 - 60_000,
  };
}

/**
 * Resolve a Google Docs API access token.
 * Preference: explicit override → env access token → service-account JWT.
 */
export async function resolveGoogleDocsAccessToken(
  overrideToken?: string | null,
): Promise<string | null> {
  const explicit = overrideToken?.trim();
  if (explicit) return explicit;

  const envToken = readEnvValue("GOOGLE_DOCS_ACCESS_TOKEN");
  if (envToken) return envToken;

  const cached = (globalThis as GlobalTokenStore)[GLOBAL_TOKEN_KEY];
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.accessToken;
  }

  const account = parseServiceAccountJson(
    readEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON"),
  );
  if (!account) return null;

  const next = await mintServiceAccountAccessToken(account);
  (globalThis as GlobalTokenStore)[GLOBAL_TOKEN_KEY] = next;
  return next.accessToken;
}

export function googleDocExportTextUrl(
  documentId = DASHBOARD_CONFIG_GOOGLE_DOC_ID,
): string {
  return `https://docs.google.com/document/d/${documentId}/export?format=txt`;
}

function appendStructuralText(
  elements: GoogleDocsStructuralElement[] | undefined,
  parts: string[],
): void {
  if (!elements) return;
  for (const element of elements) {
    if (element.paragraph?.elements) {
      let line = "";
      for (const piece of element.paragraph.elements) {
        line += piece.textRun?.content ?? "";
      }
      parts.push(line);
      continue;
    }
    if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          appendStructuralText(cell.content, parts);
        }
      }
    }
  }
}

export function extractPlainTextFromGoogleDoc(
  doc: GoogleDocsDocument,
): string {
  const parts: string[] = [];
  appendStructuralText(doc.body?.content, parts);
  return parts.join("").replace(/\u000b/g, "\n");
}

async function fetchGoogleDocViaApi(
  documentId: string,
  accessToken: string,
): Promise<{ text: string; endIndex: number }> {
  const response = await fetch(`${DOCS_API_BASE}/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google Docs get failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
  const doc = (await response.json()) as GoogleDocsDocument;
  const content = doc.body?.content ?? [];
  let endIndex = 1;
  for (const element of content) {
    if (typeof element.endIndex === "number") {
      endIndex = Math.max(endIndex, element.endIndex);
    }
  }
  return { text: extractPlainTextFromGoogleDoc(doc), endIndex };
}

async function fetchGoogleDocPlainText(options: {
  documentId?: string;
  accessToken?: string | null;
}): Promise<string> {
  const documentId = options.documentId ?? DASHBOARD_CONFIG_GOOGLE_DOC_ID;
  const accessToken = await resolveGoogleDocsAccessToken(options.accessToken);

  if (accessToken) {
    try {
      const { text } = await fetchGoogleDocViaApi(documentId, accessToken);
      return text;
    } catch (err) {
      // Fall through to public export only for auth failures.
      if (err instanceof Error && !/\(401\)|\(403\)/.test(err.message)) {
        throw err;
      }
    }
  }

  const publicResponse = await fetch(googleDocExportTextUrl(documentId), {
    cache: "no-store",
    redirect: "follow",
  });
  if (!publicResponse.ok) {
    throw new Error(
      `Google Doc is not readable (${publicResponse.status}). Share it with the service account / access token, or set link sharing to Viewer.`,
    );
  }
  return publicResponse.text();
}

/** Parse Dashboard Configuration text from the Google Doc body. */
export function parseDashboardConfigFromGoogleDocText(
  text: string,
): ProgramConfig | null {
  const parsed = parseProgramConfigText(text);
  if ("error" in parsed) return null;
  return sanitizeProgramConfig(parsed.config);
}

export async function readProgramConfigFromGoogleDoc(options?: {
  accessToken?: string | null;
  documentId?: string;
}): Promise<ProgramConfig | null> {
  const text = await fetchGoogleDocPlainText({
    documentId: options?.documentId,
    accessToken: options?.accessToken,
  });
  if (!text.trim()) return null;
  return parseDashboardConfigFromGoogleDocText(text);
}

/**
 * Replace the Google Doc body with Dashboard Configuration text.
 * Requires Docs API edit access via token / service account.
 */
export async function writeProgramConfigToGoogleDoc(
  config: ProgramConfig,
  options?: {
    accessToken?: string | null;
    documentId?: string;
  },
): Promise<{ documentId: string; documentUrl: string; text: string }> {
  const documentId = options?.documentId ?? DASHBOARD_CONFIG_GOOGLE_DOC_ID;
  const accessToken = await resolveGoogleDocsAccessToken(options?.accessToken);
  if (!accessToken) {
    throw new Error(
      "Google Docs credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DOCS_ACCESS_TOKEN, or sign in with Google Docs access.",
    );
  }

  const text = `${formatProgramConfigText(sanitizeProgramConfig(config)).trimEnd()}\n`;
  const { endIndex } = await fetchGoogleDocViaApi(documentId, accessToken);
  const requests: Array<Record<string, unknown>> = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text,
    },
  });

  const response = await fetch(
    `${DOCS_API_BASE}/documents/${documentId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ requests }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google Docs write failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  return {
    documentId,
    documentUrl: DASHBOARD_CONFIG_GOOGLE_DOC_URL,
    text,
  };
}

export function hasGoogleDocsWriteCredentials(
  overrideToken?: string | null,
): boolean {
  if (overrideToken?.trim()) return true;
  if (readEnvValue("GOOGLE_DOCS_ACCESS_TOKEN")) return true;
  return Boolean(parseServiceAccountJson(readEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON")));
}
