import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const leagueId = params.id;
  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const updated = await prisma.league.update({
    where: { id: leagueId },
    data: { name: name.trim() },
  });

  return NextResponse.json({ id: updated.id, name: updated.name });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const leagueId = params.id;
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  // Clean up fake user records created for test players
  const fakePlayers = await prisma.leaguePlayer.findMany({
    where: { leagueId, isFake: true },
  });
  const fakeUserIds = fakePlayers.map((p) => p.userId);

  // Cascade delete handles league -> seasons -> games -> rounds -> answers etc.
  await prisma.league.delete({ where: { id: leagueId } });

  if (fakeUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: fakeUserIds } } });
  }

  return NextResponse.json({ deleted: true });
}
