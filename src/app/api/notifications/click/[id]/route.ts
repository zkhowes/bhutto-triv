import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });

  if (!notification) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Record the click and mark as read
  await prisma.notification.update({
    where: { id: params.id },
    data: {
      clickedAt: notification.clickedAt ?? new Date(),
      isRead: true,
    },
  });

  // `link` stores the final destination URL (e.g., /rounds/abc)
  const destination = notification.link ?? "/dashboard";

  return NextResponse.redirect(new URL(destination, request.url));
}
