import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  filterLoginActivity,
  parseLoginActivityEvent,
  type LoginActivityEvent,
  LOGIN_ACTIVITY_MAX_EVENTS,
} from "./login-activity";

const GLOBAL_KEY = "__esadLoginActivityEvents__";
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "login-activity.json");

type GlobalLoginStore = typeof globalThis & {
  [GLOBAL_KEY]?: LoginActivityEvent[];
};

function memoryStore(): LoginActivityEvent[] {
  const globalStore = globalThis as GlobalLoginStore;
  if (!globalStore[GLOBAL_KEY]) {
    globalStore[GLOBAL_KEY] = [];
  }
  return globalStore[GLOBAL_KEY]!;
}

async function readPersistedEvents(): Promise<LoginActivityEvent[]> {
  try {
    const text = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => parseLoginActivityEvent(entry))
      .filter((entry): entry is LoginActivityEvent => entry != null);
  } catch {
    return [];
  }
}

async function writePersistedEvents(events: LoginActivityEvent[]): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  } catch {
    // File persistence is best-effort (read-only / serverless hosts may fail).
  }
}

async function loadEvents(): Promise<LoginActivityEvent[]> {
  const memory = memoryStore();
  if (memory.length > 0) {
    return filterLoginActivity(memory);
  }
  const persisted = filterLoginActivity(await readPersistedEvents());
  memory.splice(0, memory.length, ...persisted);
  return persisted;
}

export async function listLoginActivity(
  now: Date = new Date(),
): Promise<LoginActivityEvent[]> {
  const events = await loadEvents();
  return filterLoginActivity(events, now);
}

export async function recordLoginActivity(
  email: string,
  at: Date = new Date(),
): Promise<LoginActivityEvent | null> {
  const event = parseLoginActivityEvent({
    email,
    at: at.toISOString(),
  });
  if (!event) return null;

  const existing = await loadEvents();
  // Dedupe the same email within a 5-minute window to avoid refresh spam.
  const recentSame = existing.find((entry) => {
    if (entry.email !== event.email) return false;
    return Math.abs(Date.parse(entry.at) - Date.parse(event.at)) < 5 * 60_000;
  });
  if (recentSame) return recentSame;

  const next = filterLoginActivity([event, ...existing]).slice(
    0,
    LOGIN_ACTIVITY_MAX_EVENTS,
  );
  const memory = memoryStore();
  memory.splice(0, memory.length, ...next);
  await writePersistedEvents(next);
  return event;
}
