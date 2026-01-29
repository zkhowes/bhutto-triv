import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const link = await prisma.shareableLink.findUnique({
    where: { token: params.token },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          type: true,
          inviteCode: true,
        },
      },
    },
  });

  if (!link || !link.isActive) {
    return NextResponse.json(
      { error: "Link not found or expired" },
      { status: 404 }
    );
  }

  // Increment view count
  await prisma.shareableLink.update({
    where: { id: link.id },
    data: { viewCount: link.viewCount + 1 },
  });

  return NextResponse.json({
    type: link.type,
    league: link.league,
    entityId: link.entityId,
  });
}
