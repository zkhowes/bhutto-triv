import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// POST - Create shareable link
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId, type, entityId } = await req.json();

  if (!leagueId || !type) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify user is a member of the league
  const membership = await prisma.leaguePlayer.findFirst({
    where: { leagueId, userId: session.user.id, isActive: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  const token = nanoid(21);
  const link = await prisma.shareableLink.create({
    data: {
      leagueId,
      type,
      token,
      entityId,
    },
  });

  return NextResponse.json({
    token: link.token,
    url: `${process.env.NEXTAUTH_URL}/share/${link.token}`,
  });
}
