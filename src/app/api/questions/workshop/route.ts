import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { workshopQuestion } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "Messages array is required" },
      { status: 400 }
    );
  }

  try {
    const response = await workshopQuestion(messages);
    return NextResponse.json({ response });
  } catch {
    return NextResponse.json(
      { error: "AI workshop temporarily unavailable" },
      { status: 500 }
    );
  }
}
