import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Check if the current session belongs to the admin user.
 * Returns the session if authorized, null otherwise.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  if (!ADMIN_EMAIL || session.user.email !== ADMIN_EMAIL) return null;
  return session;
}

/**
 * Simple boolean check for admin access (for backward compat with existing API routes).
 */
export async function isAdminAuthenticated(_userId?: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (!ADMIN_EMAIL || session.user.email !== ADMIN_EMAIL) return false;
  return true;
}
