import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { timingSafeEqual } from "crypto";
import { authOptions } from "@/lib/auth";
import { isAdminAuthenticated, createAdminSession, deleteAdminSession } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

// GET - Check if current session is authenticated
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const isAuthenticated = await isAdminAuthenticated(session.user.id);

  return NextResponse.json({ authenticated: isAuthenticated });
}

// POST - Verify password and authenticate session
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be logged in" },
      { status: 401 }
    );
  }

  // Rate limit: 5 attempts per 15 minutes per user
  const rl = rateLimit(`admin-auth:${session.user.id}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.resetInSeconds} seconds.` },
      { status: 429 }
    );
  }

  const { password } = await req.json();

  // Check password against environment variable
  const correctPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!correctPassword) {
    return NextResponse.json(
      { error: "Super admin password not configured" },
      { status: 500 }
    );
  }

  const a = Buffer.from(password);
  const b = Buffer.from(correctPassword);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 403 }
    );
  }

  // Store session as authenticated (DB-backed, 24h TTL)
  await createAdminSession(session.user.id);

  return NextResponse.json({ authenticated: true });
}

// DELETE - Log out from super admin
export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteAdminSession(session.user.id);

  return NextResponse.json({ success: true });
}
