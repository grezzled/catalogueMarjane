import prisma from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory fallback when the DB is unavailable (build time, etc.)
const memoryFallback = new Map<string, { count: number; resetAt: number }>();

let tableEnsured = false;

async function ensureTable(): Promise<boolean> {
  if (tableEnsured) return true;
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS admin_login_attempts (
        ip TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        resetAt INTEGER NOT NULL
      )`
    );
    tableEnsured = true;
    return true;
  } catch (err) {
    console.error("Rate-limit table init failed, using memory fallback:", err);
    return false;
  }
}

function memoryCheck(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const attempt = memoryFallback.get(ip);
  if (!attempt || now > attempt.resetAt) {
    memoryFallback.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (attempt.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((attempt.resetAt - now) / 1000),
    };
  }
  attempt.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkLoginRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const dbReady = await ensureTable();
  if (!dbReady) return memoryCheck(ip);

  try {
    const now = Date.now();
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT count, resetAt FROM admin_login_attempts WHERE ip = ? LIMIT 1`,
      ip
    )) as Array<{ count: number; resetAt: number }>;
    const row = rows[0];

    if (!row || now > Number(row.resetAt)) {
      await prisma.$executeRawUnsafe(
        `INSERT OR REPLACE INTO admin_login_attempts (ip, count, resetAt) VALUES (?, 1, ?)`,
        ip,
        now + WINDOW_MS
      );
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (Number(row.count) >= MAX_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((Number(row.resetAt) - now) / 1000)
        ),
      };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE admin_login_attempts SET count = count + 1 WHERE ip = ?`,
      ip
    );
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    console.error("Rate-limit DB check failed, using memory fallback:", err);
    return memoryCheck(ip);
  }
}

export async function clearLoginRateLimit(ip: string): Promise<void> {
  memoryFallback.delete(ip);
  try {
    if (await ensureTable()) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM admin_login_attempts WHERE ip = ?`,
        ip
      );
    }
  } catch (err) {
    console.error("Failed to clear rate-limit entry:", err);
  }
}
