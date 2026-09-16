import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminCookie } from "./admin-auth";

/**
 * Defense-in-depth admin check for API routes.
 *
 * The edge proxy (src/proxy.ts) is the first gate, but routes must not
 * depend on it alone — a stale build, misconfigured matcher, or framework
 * change could otherwise expose queue/worker controls publicly.
 */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value);
}

/**
 * Returns a 401 response when the caller is not an admin,
 * or null when the request may proceed.
 *
 * Usage at the top of a route handler:
 *   const denied = await adminGuard();
 *   if (denied) return denied;
 */
export async function adminGuard(): Promise<NextResponse | null> {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
