import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const BLOCKED_SCHEMES = ["javascript:", "data:", "blob:", "file:", "ftp:"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`image-validate-${session.user.id}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Block dangerous schemes
  const lower = url.toLowerCase().trim();
  if (BLOCKED_SCHEMES.some((s) => lower.startsWith(s))) {
    return NextResponse.json(
      { error: "URL scheme not allowed" },
      { status: 400 }
    );
  }

  // Must be https
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only HTTPS URLs are allowed" },
      { status: 400 }
    );
  }

  // Server-side HEAD request to verify image content-type
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });

    const contentType = head.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL does not point to an image" },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true, url });
  } catch {
    return NextResponse.json(
      { error: "Could not verify URL — it may be unreachable" },
      { status: 400 }
    );
  }
}
