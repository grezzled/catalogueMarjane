import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "admin_auth";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const COOKIE_VERSION = "v1";

function messageForExpiry(exp: number): string {
  return `${COOKIE_VERSION}:admin-auth:${exp}`;
}

export function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

export function signAdminCookie(expiresAtSeconds: number): string | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  const sig = createHmac("sha256", secret)
    .update(messageForExpiry(expiresAtSeconds))
    .digest("hex");
  return `${COOKIE_VERSION}.${expiresAtSeconds}.${sig}`;
}

export function createAdminCookieValue(): string | null {
  const exp =
    Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  return signAdminCookie(exp);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** Node-runtime verification (API routes, server components). */
export function verifyAdminCookie(value: string | undefined | null): boolean {
  if (!value) return false;
  const secret = getAdminSecret();
  if (!secret) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [version, expStr, sig] = parts;
  if (version !== COOKIE_VERSION) return false;
  const exp = Number(expStr);
  if (!Number.isInteger(exp)) return false;
  if (exp * 1000 <= Date.now()) return false;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expected = createHmac("sha256", secret)
    .update(messageForExpiry(exp))
    .digest("hex");
  return safeEqualHex(sig, expected);
}

/** Constant-time password comparison to avoid timing leaks. */
export function passwordsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
