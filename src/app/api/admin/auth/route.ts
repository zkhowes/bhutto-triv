import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authenticatedSessions } from "@/lib/admin-auth";

// GET - Check if current session is authenticated
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const isAuthenticated = authenticatedSessions.has(session.user.id);

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

  const { password } = await req.json();

  // Check password against environment variable
  const correctPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!correctPassword) {
    return NextResponse.json(
      { error: "Super admin password not configured" },
      { status: 500 }
    );
  }

  if (password !== correctPassword) {
    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 403 }
    );
  }

  // Store session as authenticated
  authenticatedSessions.add(session.user.id);

  return NextResponse.json({ authenticated: true });
}

// DELETE - Log out from super admin
export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  authenticatedSessions.delete(session.user.id);

  return NextResponse.json({ success: true });
}
