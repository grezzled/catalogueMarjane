import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import {
  getAiSettings,
  paidKeyStatus,
  updateAiSettings,
} from "@/services/ai-settings";

export const runtime = "nodejs";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const settings = await getAiSettings();
  // Booleans/counts only — key material never leaves the server.
  return NextResponse.json({ ...settings, ...paidKeyStatus() });
}

export async function PUT(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.usePaidKey !== "boolean") {
    return NextResponse.json({ error: "usePaidKey must be a boolean" }, { status: 400 });
  }
  try {
    const settings = await updateAiSettings({ usePaidKey: body.usePaidKey });
    return NextResponse.json({ ...settings, ...paidKeyStatus() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
