import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      nickname: true,
      phoneNumber: true,
      timezone: true,
      avatarUrl: true,
      image: true,
      profileComplete: true,
    },
  });

  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nickname, phoneNumber, timezone, avatarUrl } = body;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nickname: nickname || undefined,
      phoneNumber: phoneNumber || undefined,
      timezone: timezone || undefined,
      avatarUrl: avatarUrl || undefined,
      profileComplete: !!(nickname && phoneNumber && timezone),
    },
  });

  return NextResponse.json(user);
}
