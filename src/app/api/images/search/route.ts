import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  searchUnsplash,
  searchGoogle,
  getAvailableSources,
} from "@/lib/image-search";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`image-search-${session.user.id}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", resetInSeconds: rl.resetInSeconds },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { query, source } = body as {
    query: string;
    source: "unsplash" | "google";
  };

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }

  if (!["unsplash", "google"].includes(source)) {
    return NextResponse.json(
      { error: "Invalid source" },
      { status: 400 }
    );
  }

  const results =
    source === "unsplash"
      ? await searchUnsplash(query.trim())
      : await searchGoogle(query.trim());

  return NextResponse.json({ results });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sources: getAvailableSources() });
}
