import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`image-upload-${session.user.id}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", resetInSeconds: rl.resetInSeconds },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }

  // Validate content type from header
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: jpg, png, gif, webp" },
      { status: 400 }
    );
  }

  // Validate magic bytes
  const buffer = Buffer.from(await file.arrayBuffer());
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    return NextResponse.json(
      { error: "File content does not match an allowed image type" },
      { status: 400 }
    );
  }

  try {
    const blob = await put(
      `question-images/${session.user.id}/${Date.now()}-${file.name}`,
      buffer,
      {
        access: "public",
        contentType: detected.mime,
      }
    );

    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
