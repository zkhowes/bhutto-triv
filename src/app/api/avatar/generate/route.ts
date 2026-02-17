import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateAvatarSvg } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description } = await req.json();
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Description required" }, { status: 400 });
  }

  try {
    const avatarUrl = await generateAvatarSvg(description);
    return NextResponse.json({ avatarUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate avatar" },
      { status: 500 }
    );
  }
}
