import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/services/subscribers";

export const runtime = "nodejs";

// GET /api/unsubscribe?token=… — one-click opt-out (used in future mailings).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }

  try {
    const done = await unsubscribeByToken(token);
    if (!done) {
      return NextResponse.json({ error: "Lien invalide ou déjà utilisé." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Désinscription impossible pour le moment." }, { status: 500 });
  }
}
