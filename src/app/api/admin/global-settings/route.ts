import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const settings = await prisma.globalSettings.findUnique({
    where: { id: "singleton" },
  });

  return NextResponse.json(settings ?? { id: "singleton", notificationOverride: "commissioner" });
}

export async function PUT(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const body = await req.json();
  const { notificationOverride } = body;

  if (!["none", "commissioner"].includes(notificationOverride)) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const settings = await prisma.globalSettings.upsert({
    where: { id: "singleton" },
    update: { notificationOverride },
    create: { id: "singleton", notificationOverride },
  });

  return NextResponse.json(settings);
}
