import { GoogleAuth } from "google-auth-library";
import fs from "fs/promises";

const SCOPES = ["https://www.googleapis.com/auth/indexing"];
const INDEXING_API_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

let cachedAuth: GoogleAuth | null = null;
let cachedSource = "";

/** Credential source key, so a key rotation (new file contents) is picked up. */
async function loadCredentials(): Promise<{ source: string; json: Record<string, unknown> }> {
  // Preferred: shared service-account key (also used by the SEO dashboard).
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return { source: `inline:${inline.length}`, json: JSON.parse(inline) };
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    const raw = await fs.readFile(file, "utf8");
    return { source: `file:${file}:${raw.length}`, json: JSON.parse(raw) };
  }
  // Legacy: dedicated Indexing API variable (must be single-line JSON).
  const legacy = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (legacy) {
    return { source: `legacy:${legacy.length}`, json: JSON.parse(legacy) };
  }
  throw new Error(
    "No Google credentials: set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE (shared with /admin/seo)"
  );
}

async function getAuth(): Promise<GoogleAuth> {
  const { source, json } = await loadCredentials();
  if (!cachedAuth || cachedSource !== source) {
    cachedAuth = new GoogleAuth({ credentials: json, scopes: SCOPES });
    cachedSource = source;
  }
  return cachedAuth;
}

export async function pingGoogleIndexing(url: string): Promise<boolean> {
  try {
    const auth = await getAuth();
    const client = await auth.getClient();

    const response = await client.request({
      url: INDEXING_API_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        url,
        type: "URL_UPDATED",
      },
    });

    if (response.status === 200) {
      console.log(`[Indexing] Successfully pinged Google for: ${url}`);
      return true;
    } else {
      console.warn(`[Indexing] Unexpected status ${response.status} for: ${url}`);
      return false;
    }
  } catch (error) {
    console.error(`[Indexing] Failed to ping Google for ${url}:`, error);
    return false;
  }
}

export async function removeGoogleIndexing(url: string): Promise<boolean> {
  try {
    const auth = await getAuth();
    const client = await auth.getClient();

    const response = await client.request({
      url: INDEXING_API_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        url,
        type: "URL_DELETED",
      },
    });

    if (response.status === 200) {
      console.log(`[Indexing] Successfully requested removal for: ${url}`);
      return true;
    } else {
      console.warn(`[Indexing] Unexpected status ${response.status} for removal: ${url}`);
      return false;
    }
  } catch (error) {
    console.error(`[Indexing] Failed to request removal for ${url}:`, error);
    return false;
  }
}
