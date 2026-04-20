import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Gate API routes on super admin. Returns an error response if the session is
 * missing or the user is not a super admin, otherwise returns the session.
 *
 * Super admin status lives on User.isSuperAdmin and is surfaced on the session
 * by the JWT/session callbacks in src/lib/auth.ts.
 */
export async function requireSuperAdmin(): Promise<
  { session: Session; error: null } | { session: null; error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.user.isSuperAdmin) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}
