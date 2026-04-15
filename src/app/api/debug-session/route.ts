import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// TEMPORARY - remove after debugging
export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: (session?.user as Record<string, unknown>)?.id ?? null,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
    profileComplete: (session?.user as Record<string, unknown>)?.profileComplete ?? null,
    isSuperAdmin: (session?.user as Record<string, unknown>)?.isSuperAdmin ?? null,
  });
}
