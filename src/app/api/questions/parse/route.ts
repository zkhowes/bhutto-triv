import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseQuestionFromText } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  try {
    const parsed = await parseQuestionFromText(text);
    if (!parsed) {
      return NextResponse.json({ error: "Could not parse question from text" }, { status: 422 });
    }
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse" },
      { status: 500 }
    );
  }
}
