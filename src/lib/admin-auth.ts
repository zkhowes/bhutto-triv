import { prisma } from "./prisma";

const SESSION_TTL_HOURS = 24;

/**
 * Check if a user has a valid (non-expired) admin session.
 */
export async function isAdminAuthenticated(userId: string): Promise<boolean> {
  const session = await prisma.adminSession.findUnique({
    where: { userId },
  });
  if (!session) return false;
  if (session.expiresAt < new Date()) {
    // Expired — clean up
    await prisma.adminSession.delete({ where: { userId } }).catch(() => {});
    return false;
  }
  return true;
}

/**
 * Create or refresh an admin session with a 24h TTL.
 */
export async function createAdminSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.adminSession.upsert({
    where: { userId },
    update: { expiresAt },
    create: { userId, expiresAt },
  });
}

/**
 * Delete an admin session (logout).
 */
export async function deleteAdminSession(userId: string): Promise<void> {
  await prisma.adminSession.delete({ where: { userId } }).catch(() => {});
}
