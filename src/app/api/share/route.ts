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

  const token = nanoid(12);
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
