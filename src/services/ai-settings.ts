import prisma from "@/lib/prisma";

/**
 * Singleton AI billing switch.
 * DEFAULT IS ALWAYS FREE (false) — the paid key is only touched when
 * the admin explicitly enables it in /admin/settings.
 */

export async function getAiSettings(): Promise<{ usePaidKey: boolean }> {
  try {
    let row = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });
    if (!row) {
      row = await prisma.aiSettings.create({
        data: { id: "singleton", usePaidKey: false },
      });
    }
    return { usePaidKey: row.usePaidKey === true };
  } catch {
    // DB unreachable → safest option: FREE tier.
    return { usePaidKey: false };
  }
}

/** Double-guard: returns true only when DB flag is true AND a paid key exists. */
export async function shouldUsePaidKey(): Promise<boolean> {
  const { usePaidKey } = await getAiSettings();
  if (usePaidKey !== true) return false;
  const paid = (process.env.GEMINI_PAID_KEY || "").trim();
  return paid.length > 0;
}

export async function updateAiSettings(patch: {
  usePaidKey?: unknown;
}): Promise<{ usePaidKey: boolean }> {
  if (typeof patch.usePaidKey !== "boolean") {
    throw new Error("usePaidKey must be a boolean");
  }
  // Refuse to arm billing when no paid key is configured — prevents a
  // checked box that silently does nothing (or worse, a misconfig).
  if (patch.usePaidKey === true) {
    const paid = (process.env.GEMINI_PAID_KEY || "").trim();
    if (paid.length === 0) {
      throw new Error("GEMINI_PAID_KEY is not configured on the server");
    }
  }
  const row = await prisma.aiSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", usePaidKey: patch.usePaidKey },
    update: { usePaidKey: patch.usePaidKey },
  });
  return { usePaidKey: row.usePaidKey === true };
}

/** Server-only helper for status UI — booleans/counts only, never key material. */
export function paidKeyStatus(): { paidKeySet: boolean; freeKeyCount: number } {
  const paidKeySet = (process.env.GEMINI_PAID_KEY || "").trim().length > 0;
  const freeKeyCount = (process.env.GEMINI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean).length;
  return { paidKeySet, freeKeyCount };
}
