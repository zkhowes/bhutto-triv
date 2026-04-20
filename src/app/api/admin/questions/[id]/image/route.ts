import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = params;

  try {
    const question = await prisma.question.findUnique({
      where: { id },
      select: { id: true, imageUrl: true, imageSource: true },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // If image was uploaded to Vercel Blob, clean it up
    if (question.imageSource === "upload" && question.imageUrl) {
      try {
        const { del } = await import("@vercel/blob");
        await del(question.imageUrl);
      } catch (blobErr) {
        // Log but don't fail — still remove the DB reference
        console.error("Failed to delete blob:", blobErr);
      }
    }

    await prisma.question.update({
      where: { id },
      data: {
        imageUrl: null,
        imageSource: null,
        imageAttribution: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove question image:", error);
    return NextResponse.json(
      { error: "Failed to remove image" },
      { status: 500 }
    );
  }
}
