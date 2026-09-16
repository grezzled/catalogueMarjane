import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export { WHATSAPP_CHANNEL_URL } from "@/lib/links";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export type SubscribeResult =
  | { status: "subscribed" }
  | { status: "already" };

/**
 * Idempotent subscribe: new emails are created, unsubscribed ones are
 * reactivated, active ones report "already" (no duplicate rows, no error
 * leaking whether an address exists beyond the success message).
 */
export async function subscribeEmail(
  rawEmail: string,
  source?: string
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing) {
    if (existing.active) return { status: "already" };
    await prisma.subscriber.update({
      where: { email },
      data: {
        active: true,
        unsubscribedAt: null,
        source: source ?? existing.source,
      },
    });
    return { status: "subscribed" };
  }

  await prisma.subscriber.create({
    data: {
      email,
      source,
      unsubscribeToken: randomUUID(),
    },
  });
  return { status: "subscribed" };
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const existing = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
  });
  if (!existing || !existing.active) return false;
  await prisma.subscriber.update({
    where: { unsubscribeToken: token },
    data: { active: false, unsubscribedAt: new Date() },
  });
  return true;
}
