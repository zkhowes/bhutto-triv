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
      notificationPreference: true,
      preferredSendHour: true,
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
  const { nickname, phoneNumber, timezone, avatarUrl, notificationPreference, preferredSendHour } = body;

  // Validate notificationPreference if provided
  const validPreferences = [null, "none", "low", "high"];
  const prefValue = notificationPreference === undefined
    ? undefined
    : validPreferences.includes(notificationPreference)
      ? (notificationPreference ?? null)
      : undefined;

  // Validate preferredSendHour: null clears it, integer 0-23 sets it, anything else ignored.
  let sendHourValue: number | null | undefined = undefined;
  if (preferredSendHour === null) {
    sendHourValue = null;
  } else if (typeof preferredSendHour === "number" && Number.isInteger(preferredSendHour) && preferredSendHour >= 0 && preferredSendHour <= 23) {
    sendHourValue = preferredSendHour;
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nickname: nickname || undefined,
      phoneNumber: phoneNumber || undefined,
      timezone: timezone || undefined,
      avatarUrl: avatarUrl !== undefined ? (avatarUrl || null) : undefined,
      profileComplete: !!(nickname && phoneNumber && timezone),
      ...(prefValue !== undefined ? { notificationPreference: prefValue } : {}),
      ...(sendHourValue !== undefined ? { preferredSendHour: sendHourValue } : {}),
    },
  });

  return NextResponse.json(user);
}
