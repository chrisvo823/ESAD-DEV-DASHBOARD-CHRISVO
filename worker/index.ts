/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  /** OpenAI Sites / Wrangler secrets & vars (string bindings). */
  SMARTSHEET_ACCESS_TOKEN?: string;
  ESAD_SITE_CONFIG_DIR?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  GOOGLE_DOCS_ACCESS_TOKEN?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_WEB_CONFIG?: string;
  NEXT_PUBLIC_FIREBASE_WEB_CONFIG?: string;
  NEXT_PUBLIC_FIREBASE_API_KEY?: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_FIREBASE_APP_ID?: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN?: string;
  [key: string]: unknown;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * OpenAI Sites / Cloudflare Workers expose secrets on the Worker `env` object.
 * App code (and vinext shims) read `process.env.*`. Without
 * `nodejs_compat_populate_process_env`, those bindings are not mirrored — which
 * made Current/Next Task show "Unavailable" even when SMARTSHEET_ACCESS_TOKEN
 * was configured as a Site secret.
 */
const PROCESS_ENV_BINDING_KEYS = [
  "SMARTSHEET_ACCESS_TOKEN",
  "ESAD_SITE_CONFIG_DIR",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "GOOGLE_DOCS_ACCESS_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_WEB_CONFIG",
  "NEXT_PUBLIC_FIREBASE_WEB_CONFIG",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN",
] as const;

function mirrorEnvBindingsToProcessEnv(env: Env): void {
  for (const key of PROCESS_ENV_BINDING_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    mirrorEnvBindingsToProcessEnv(env);

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
