import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LATEST_RELEASE = new Date("2026-03-24");

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ show: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      profileComplete: true,
      createdAt: true,
      lastSeenWhatsNew: true,
    },
  });

  if (!user) {
    return NextResponse.json({ show: false });
  }

  const show =
    user.profileComplete === true &&
    user.createdAt < LATEST_RELEASE &&
    (user.lastSeenWhatsNew === null || user.lastSeenWhatsNew < LATEST_RELEASE);

  return NextResponse.json({ show });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastSeenWhatsNew: new Date() },
  });

  return NextResponse.json({ ok: true });
}
