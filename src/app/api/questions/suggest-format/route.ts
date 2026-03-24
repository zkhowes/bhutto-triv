import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { suggestFormat } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`suggest-format:${session.user.id}`, 10, 60);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { questionText, correctAnswer, acceptableAnswers } = await req.json();

  if (!questionText || !correctAnswer) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const suggestion = await suggestFormat(
    questionText,
    correctAnswer,
    acceptableAnswers || []
  );

  return NextResponse.json({ suggestion });
}
