import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { editWorkshopQuestion } from "@/lib/ai";
import type { WorkshopVariation } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question, instruction } = await req.json();

  if (!question || !instruction || typeof instruction !== "string") {
    return NextResponse.json(
      { error: "Question and instruction are required" },
      { status: 400 }
    );
  }

  try {
    const response = await editWorkshopQuestion(
      question as WorkshopVariation,
      instruction
    );
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "AI workshop temporarily unavailable" },
      { status: 500 }
    );
  }
}
