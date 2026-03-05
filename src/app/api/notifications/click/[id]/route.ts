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
  // Only allow relative URLs to prevent open redirect attacks
  const destination = notification.link ?? "/dashboard";
  const safeDestination = destination.startsWith("/") ? destination : "/dashboard";

  return NextResponse.redirect(new URL(safeDestination, request.url));
}
