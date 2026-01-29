import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - transfer commissioner role
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newCommissionerId } = await req.json();
  const leagueId = params.id;

  // Verify current commissioner
  const currentCommissioner = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId,
      userId: session.user.id,
      role: "commissioner",
      isActive: true,
    },
  });

  if (!currentCommissioner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Verify new commissioner is active player
  const newCommissioner = await prisma.leaguePlayer.findFirst({
    where: {
      id: newCommissionerId,
      leagueId,
      isActive: true,
    },
  });

  if (!newCommissioner) {
    return NextResponse.json(
      { error: "Player not found in league" },
      { status: 404 }
    );
  }

  // Transfer role
  await prisma.$transaction([
    prisma.leaguePlayer.update({
      where: { id: currentCommissioner.id },
      data: { role: "player" },
    }),
    prisma.leaguePlayer.update({
      where: { id: newCommissioner.id },
      data: { role: "commissioner" },
    }),
  ]);

  return NextResponse.json({ success: true });
}
