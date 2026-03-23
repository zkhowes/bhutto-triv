# Image Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional image attachment to trivia questions via built-in search (Unsplash + Google), device upload (Vercel Blob), or URL paste, with AI workshop integration and admin monitoring.

**Architecture:** Three new schema fields on Question/QuestionDraft (`imageUrl`, `imageSource`, `imageAttribution`). Two new API routes for image search and upload. Two new UI components (`ImageAttachment`, `ImageSearchModal`). Workshop AI generates `imageSearchTerm` for visual questions. Images are display-only — no impact on scoring, grading, or game engine logic.

**Tech Stack:** Next.js 14, Prisma, Vercel Blob (`@vercel/blob`), Unsplash API, Google Custom Search API, `file-type` package for upload validation.

**Spec:** `docs/superpowers/specs/2026-03-23-image-questions-design.md`

---

## File Structure

### New Files
- `src/app/api/images/search/route.ts` — Unified image search endpoint (Unsplash + Google)
- `src/app/api/images/upload/route.ts` — Device upload via Vercel Blob
- `src/app/api/images/validate-url/route.ts` — Server-side URL validation (scheme check + HEAD request)
- `src/components/question/ImageAttachment.tsx` — "Add Image" toggle + preview widget
- `src/components/question/ImageSearchModal.tsx` — Search/upload/paste modal
- `src/lib/image-search.ts` — Unsplash + Google API clients

### Modified Files
- `prisma/schema.prisma` — Add image fields to Question + QuestionDraft
- `src/lib/game-engine.ts:143-195` — Thread image fields through `submitQuestion()`
- `src/lib/ai.ts:93-106,114-165` — Add `imageSearchTerm` to WorkshopVariation + system prompt
- `src/app/api/questions/route.ts:16-93` — Accept image fields in POST
- `src/app/api/questions/drafts/route.ts:83` — Add image fields to allowedFields
- `src/app/api/rounds/[id]/route.ts:144-165` — Strip `imageUrl` before bet placed
- `src/components/question/QuestionSubmitForm.tsx:39-200` — Image state + ImageAttachment
- `src/components/question/WorkshopEmbed.tsx:24-136` — Image fields in callback + card rendering
- `src/components/question/QuestionPreviewCard.tsx:3-93` — Render image on workshop cards
- `src/components/game/AnswerInterface.tsx:8-55` — Render image during answering
- `src/components/game/RoundControl.tsx:26-131` — Render image in round display
- `src/components/game/GradingInterface.tsx:30-40` — Add image to question interface
- `src/app/games/[id]/page.tsx` — Render image in game page round display
- `src/app/admin/page.tsx:84-101` — Image column + stats in admin
- `next.config.js:8-14` — Add remotePatterns for Unsplash + Vercel Blob
- `package.json` — Add `@vercel/blob`, `file-type`

---

## Task 1: Schema + Dependencies

**Files:**
- Modify: `prisma/schema.prisma:246-301`
- Modify: `package.json`
- Modify: `next.config.js:8-14`

- [ ] **Step 1: Add image fields to Question model**

In `prisma/schema.prisma`, add after `acceptableAnswers` field (around line 253):

```prisma
  // Image attachment (optional)
  imageUrl         String?
  imageSource      String?   // "unsplash" | "google" | "upload" | "url"
  imageAttribution String?   // JSON: {"name":"...","profileUrl":"..."} for Unsplash
```

- [ ] **Step 2: Add image fields to QuestionDraft model**

In `prisma/schema.prisma`, add after `acceptableAnswers` field (around line 293):

```prisma
  imageUrl         String?
  imageSource      String?
  imageAttribution String?
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
npm install @vercel/blob file-type
```

- [ ] **Step 4: Update next.config.js remotePatterns**

Replace the `images` block (lines 8-14) in `next.config.js`:

```javascript
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
```

Note: External URLs from Google search or URL paste will use `unoptimized` on the `<Image>` component since we can't enumerate all domains.

- [ ] **Step 5: Generate Prisma client and verify**

Run:
```bash
npx prisma generate
npx prisma validate
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json next.config.js
git commit -m "feat: add image question schema fields and dependencies"
```

---

## Task 2: Image Search Library

**Files:**
- Create: `src/lib/image-search.ts`

- [ ] **Step 1: Create image search library**

Create `src/lib/image-search.ts`:

```typescript
export interface ImageSearchResult {
  url: string;
  thumbnail: string;
  attribution?: {
    name: string;
    profileUrl: string;
  };
  source: "unsplash" | "google";
}

export async function searchUnsplash(
  query: string,
  perPage = 9
): Promise<ImageSearchResult[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation: "landscape",
  });

  const res = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    {
      headers: { Authorization: `Client-ID ${accessKey}` },
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.results || []).map(
    (photo: {
      urls: { regular: string; small: string };
      user: { name: string; links: { html: string } };
    }) => ({
      url: photo.urls.regular,
      thumbnail: photo.urls.small,
      attribution: {
        name: photo.user.name,
        profileUrl: photo.user.links.html,
      },
      source: "unsplash" as const,
    })
  );
}

export async function searchGoogle(
  query: string,
  perPage = 9
): Promise<ImageSearchResult[]> {
  const cseId = process.env.GOOGLE_CSE_ID;
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  if (!cseId || !apiKey) return [];

  const params = new URLSearchParams({
    q: query,
    cx: cseId,
    key: apiKey,
    searchType: "image",
    num: String(Math.min(perPage, 10)),
    safe: "active",
  });

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.items || []).map(
    (item: {
      link: string;
      image?: { thumbnailLink?: string };
    }) => ({
      url: item.link,
      thumbnail: item.image?.thumbnailLink || item.link,
      source: "google" as const,
    })
  );
}

/**
 * Returns which search sources are available based on env vars.
 */
export function getAvailableSources(): ("unsplash" | "google")[] {
  const sources: ("unsplash" | "google")[] = [];
  if (process.env.UNSPLASH_ACCESS_KEY) sources.push("unsplash");
  if (process.env.GOOGLE_CSE_ID && process.env.GOOGLE_CSE_API_KEY)
    sources.push("google");
  return sources;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/image-search.ts
git commit -m "feat: add Unsplash and Google image search library"
```

---

## Task 3: Image Search API Route

**Files:**
- Create: `src/app/api/images/search/route.ts`

- [ ] **Step 1: Create search endpoint**

Create `src/app/api/images/search/route.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/images/search/route.ts
git commit -m "feat: add image search API endpoint"
```

---

## Task 4: Image Upload API Route

**Files:**
- Create: `src/app/api/images/upload/route.ts`

- [ ] **Step 1: Create upload endpoint**

Create `src/app/api/images/upload/route.ts`:

```typescript
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
```

- [ ] **Step 2: Create URL validation endpoint**

Create `src/app/api/images/validate-url/route.ts`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/images/upload/route.ts src/app/api/images/validate-url/route.ts
git commit -m "feat: add image upload and URL validation APIs"
```

---

## Task 5: Backend Integration (Game Engine + APIs)

**Files:**
- Modify: `src/lib/game-engine.ts:143-195`
- Modify: `src/app/api/questions/route.ts:16-93`
- Modify: `src/app/api/questions/drafts/route.ts:83`
- Modify: `src/app/api/rounds/[id]/route.ts:144-165`

- [ ] **Step 1: Update submitQuestion in game-engine.ts**

Add to the `questionData` parameter type (around line 155):
```typescript
    imageUrl?: string;
    imageSource?: string;
    imageAttribution?: string;
```

Add to the `prisma.question.create` data block (around line 193):
```typescript
    imageUrl: questionData.imageUrl || null,
    imageSource: questionData.imageSource || null,
    imageAttribution: questionData.imageAttribution || null,
```

- [ ] **Step 2: Update questions POST API**

In `src/app/api/questions/route.ts`, add to the destructured body (around line 28):
```typescript
    imageUrl,
    imageSource,
    imageAttribution,
```

Add to the `submitQuestion()` call (around line 91):
```typescript
      imageUrl,
      imageSource,
      imageAttribution,
```

- [ ] **Step 3: Update drafts API allowedFields**

In `src/app/api/questions/drafts/route.ts`, update the `fields` array (line 83) to include:
```typescript
"imageUrl", "imageSource", "imageAttribution"
```

Also update the POST handler's `prisma.questionDraft.create` data block to include:
```typescript
    imageUrl: body.imageUrl || null,
    imageSource: body.imageSource || null,
    imageAttribution: body.imageAttribution || null,
```

- [ ] **Step 4: Strip imageUrl before bet in round GET API**

In `src/app/api/rounds/[id]/route.ts`, in the block where `questionText` is hidden before bet (around line 153), also add:
```typescript
      imageUrl: null,
      imageSource: null,
      imageAttribution: null,
```

This goes in the "hasn't bet yet" branch only. The "has bet" branch should keep image fields visible.

- [ ] **Step 5: Verify build**

Run:
```bash
npx prisma generate && ./node_modules/.bin/next build
```

Expected: Clean build, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/game-engine.ts src/app/api/questions/route.ts src/app/api/questions/drafts/route.ts src/app/api/rounds/[id]/route.ts
git commit -m "feat: thread image fields through game engine and APIs"
```

---

## Task 6: ImageSearchModal Component

**Files:**
- Create: `src/components/question/ImageSearchModal.tsx`

- [ ] **Step 1: Create the modal component**

Create `src/components/question/ImageSearchModal.tsx`. This is the full search/upload/paste modal:

- Full-screen on mobile, centered modal on desktop
- Two tabs: "Unsplash" / "Web Search" (hidden if API keys unavailable, check via GET `/api/images/search`)
- Search input pre-filled with `initialQuery` prop (from question text)
- 3-column grid (2-column on mobile) of tappable image thumbnails
- Selected image highlighted with border
- "Upload from Device" button triggers `<input type="file" accept="image/*">`
- "Paste URL" collapsible section with text input + https-only validation
- "Use Selected Image" button calls `onSelect({ url, source, attribution? })`
- Close button / backdrop click to dismiss

Props interface:
```typescript
interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: {
    url: string;
    source: "unsplash" | "google" | "upload" | "url";
    attribution?: string; // JSON string
  }) => void;
  initialQuery: string;
}
```

Key behaviors:
- On mount, fetch `GET /api/images/search` to determine available sources
- On search, `POST /api/images/search` with query + source
- On upload, `POST /api/images/upload` with FormData
- On URL paste, client-side validate `https://` prefix, then call `POST /api/images/validate-url` for server-side scheme check + HEAD request to verify it's an image
- Unsplash results display small "Photo by {name}" attribution text
- Loading/error states for search and upload
- Mobile: `fixed inset-0 z-50 bg-[#0a0a1a]` with sticky search bar
- Desktop: `fixed inset-0 z-50 flex items-center justify-center`, modal body max-w-2xl

- [ ] **Step 2: Commit**

```bash
git add src/components/question/ImageSearchModal.tsx
git commit -m "feat: add ImageSearchModal component"
```

---

## Task 7: ImageAttachment Component

**Files:**
- Create: `src/components/question/ImageAttachment.tsx`

- [ ] **Step 1: Create the attachment widget**

Create `src/components/question/ImageAttachment.tsx`. This is the "Add Image" toggle + preview:

```typescript
interface ImageAttachmentProps {
  imageUrl: string;
  imageSource: string;
  imageAttribution: string;
  questionText: string; // Used to seed search query
  onChange: (image: {
    url: string;
    source: string;
    attribution: string;
  } | null) => void;
}
```

States:
- **No image**: Show dashed-border "Add Image to Question" button with camera icon + "OPTIONAL" badge
- **Has image**: Show image preview (max-h-48, rounded, object-cover) with:
  - "Change" button (opens ImageSearchModal)
  - "Remove" button (calls `onChange(null)`)
  - Attribution line if source is Unsplash
  - Broken image fallback: `onError` hides img, shows "Image unavailable" placeholder

On "Add Image" click, open `ImageSearchModal` with `initialQuery` derived from `questionText`.

On modal select, call `onChange({ url, source, attribution })`.

- [ ] **Step 2: Commit**

```bash
git add src/components/question/ImageAttachment.tsx
git commit -m "feat: add ImageAttachment widget component"
```

---

## Task 8: Integrate into QuestionSubmitForm

**Files:**
- Modify: `src/components/question/QuestionSubmitForm.tsx:39-200`

- [ ] **Step 1: Add image state**

Add state declarations after existing state (around line 55):
```typescript
const [imageUrl, setImageUrl] = useState("");
const [imageSource, setImageSource] = useState("");
const [imageAttribution, setImageAttribution] = useState("");
```

- [ ] **Step 2: Add ImageAttachment to form**

Import `ImageAttachment` at the top. Insert the component between the question text textarea and the answer format tabs (around line 393):

```tsx
<ImageAttachment
  imageUrl={imageUrl}
  imageSource={imageSource}
  imageAttribution={imageAttribution}
  questionText={questionText}
  onChange={(img) => {
    if (img) {
      setImageUrl(img.url);
      setImageSource(img.source);
      setImageAttribution(img.attribution);
    } else {
      setImageUrl("");
      setImageSource("");
      setImageAttribution("");
    }
  }}
/>
```

- [ ] **Step 3: Include image fields in submission**

In the `handleSubmit` function (around line 175), add to the request body:
```typescript
...(imageUrl && {
  imageUrl,
  imageSource,
  imageAttribution,
}),
```

- [ ] **Step 4: Handle draft auto-load**

In the draft auto-load effect (around line 80), also set image state from loaded draft:
```typescript
if (draft.imageUrl) {
  setImageUrl(draft.imageUrl);
  setImageSource(draft.imageSource || "");
  setImageAttribution(draft.imageAttribution || "");
}
```

- [ ] **Step 5: Handle workshop question selection**

In the `onSelectQuestion` callback where workshop data populates the form, also set image fields:
```typescript
if (question.imageUrl) {
  setImageUrl(question.imageUrl);
  setImageSource(question.imageSource || "");
  setImageAttribution(question.imageAttribution || "");
}
```

- [ ] **Step 6: Reset image on form clear**

In any form reset logic, also clear image state:
```typescript
setImageUrl("");
setImageSource("");
setImageAttribution("");
```

- [ ] **Step 7: Verify build**

Run: `./node_modules/.bin/next build`

Expected: Clean build.

- [ ] **Step 8: Commit**

```bash
git add src/components/question/QuestionSubmitForm.tsx
git commit -m "feat: integrate image attachment into question submit form"
```

---

## Task 9: Workshop AI Integration

**Files:**
- Modify: `src/lib/ai.ts:93-165`
- Modify: `src/components/question/WorkshopEmbed.tsx:24-136`
- Modify: `src/components/question/QuestionPreviewCard.tsx:3-93`
- Modify: `src/app/questions/workshop/page.tsx`

- [ ] **Step 1: Add imageSearchTerm to WorkshopVariation**

In `src/lib/ai.ts`, add to the `WorkshopVariation` interface (around line 104):
```typescript
  imageSearchTerm?: string;
```

- [ ] **Step 2: Update workshop system prompt**

In `src/lib/ai.ts`, update the workshop system prompt (around line 140) to:

Add to the JSON schema documentation:
```
"imageSearchTerm": "a short search query for an image to accompany this question, or null if the question doesn't benefit from an image"
```

Add instruction text:
```
Actively look for opportunities to suggest image-based questions. Visual identification questions ("Who is this?", "Name this landmark", "What flag is this?") are high-joy and engaging. When a question would benefit from an image, populate imageSearchTerm with a concise, specific search query. Not every question needs an image — only suggest when it genuinely adds to the experience.
```

- [ ] **Step 3: Update WorkshopEmbed onSelectQuestion type**

In `src/components/question/WorkshopEmbed.tsx`, add to the `onSelectQuestion` callback interface (around line 34):
```typescript
    imageUrl?: string;
    imageSource?: string;
    imageAttribution?: string;
```

Update `handleUseQuestion` (around line 135) to also pass image fields if they exist on the variation.

- [ ] **Step 4: Update QuestionPreviewCard to show images**

In `src/components/question/QuestionPreviewCard.tsx`, add to the props interface:
```typescript
  imageUrl?: string;
  imageSearchTerm?: string;
  onImageClick?: () => void;
```

Add image rendering below the question text:
```tsx
{imageUrl && (
  <div className="relative mb-3">
    <img
      src={imageUrl}
      alt="Question image"
      className="rounded-lg w-full max-h-48 object-cover cursor-pointer"
      onClick={onImageClick}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
    <span className="absolute bottom-2 right-2 bg-black/60 text-xs text-blue-400 px-2 py-1 rounded">
      Click to change
    </span>
  </div>
)}
{!imageUrl && imageSearchTerm && (
  <button
    onClick={onImageClick}
    className="w-full mb-3 py-2 border border-dashed border-blue-500/50 rounded-lg text-blue-400 text-sm hover:bg-blue-500/10 transition-colors"
  >
    + Add suggested image
  </button>
)}
```

- [ ] **Step 5: Wire up image search in WorkshopEmbed**

In `WorkshopEmbed`, when cards are generated and a variation has `imageSearchTerm`:
- For the first card only (rate limit optimization), auto-call `POST /api/images/search` with `{ query: imageSearchTerm, source: "unsplash" }`
- Store the first result URL as a preview `imageUrl` on that variation in local state
- Lazy-load images for other cards when they are expanded/hovered
- Clicking the image on a card opens `ImageSearchModal` pre-filled with the `imageSearchTerm`

Also update the standalone workshop page (`src/app/questions/workshop/page.tsx`) with the same logic.

- [ ] **Step 6: Verify build**

Run: `./node_modules/.bin/next build`

Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai.ts src/components/question/WorkshopEmbed.tsx src/components/question/QuestionPreviewCard.tsx src/app/questions/workshop/page.tsx
git commit -m "feat: integrate image suggestions into AI workshop"
```

---

## Task 10: Gameplay Display (Answer + Results)

**Files:**
- Modify: `src/components/game/AnswerInterface.tsx:8-55`
- Modify: `src/components/game/RoundControl.tsx:26-131`
- Modify: `src/app/games/[id]/page.tsx`
- Modify: `src/components/game/GradingInterface.tsx:30-40`

- [ ] **Step 1: Update AnswerInterface**

In `src/components/game/AnswerInterface.tsx`, add to the `question` prop type (around line 18):
```typescript
    imageUrl?: string | null;
    imageAttribution?: string | null;
```

Add image rendering above the question text / answer options (before the format-specific sections):
```tsx
{question.imageUrl && (
  <div className="mb-4">
    <img
      src={question.imageUrl}
      alt="Question image"
      className="rounded-xl w-full max-h-64 object-cover"
      onError={(e) => {
        (e.target as HTMLImageElement).parentElement!.style.display = "none";
      }}
    />
    {question.imageAttribution && (() => {
      try {
        const attr = JSON.parse(question.imageAttribution);
        return (
          <p className="text-xs text-[#a0a0b8] mt-1">
            Photo by{" "}
            <a href={attr.profileUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {attr.name}
            </a>{" "}
            on Unsplash
          </p>
        );
      } catch { return null; }
    })()}
  </div>
)}
```

- [ ] **Step 2: Update RoundControl**

In `src/components/game/RoundControl.tsx`, add `imageUrl` and `imageAttribution` to the question type (around line 30). Add the same image rendering block after the question text display (around line 130).

- [ ] **Step 3: Update game page round display**

In `src/app/games/[id]/page.tsx`, find where question details are displayed for completed/graded rounds. Add image rendering in the question reveal section. Same pattern: render image above question text with broken-image fallback and attribution. Note: `RoundControl.tsx` (Step 2) handles the primary round display; the game page may also show question summaries for past rounds.

- [ ] **Step 4: Update GradingInterface**

In `src/components/game/GradingInterface.tsx`, add `imageUrl: string | null` and `imageAttribution: string | null` to the Question interface (around line 39). Add image rendering in the question display section so the grader has full context.

- [ ] **Step 5: Verify build**

Run: `./node_modules/.bin/next build`

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/components/game/AnswerInterface.tsx src/components/game/RoundControl.tsx src/app/games/[id]/page.tsx src/components/game/GradingInterface.tsx
git commit -m "feat: display question images in gameplay views"
```

---

## Task 11: Admin Integration

**Files:**
- Modify: `src/app/admin/page.tsx:84-101`

- [ ] **Step 1: Add image fields to QuestionData interface**

In `src/app/admin/page.tsx`, add to the `QuestionData` interface (around line 91):
```typescript
  imageUrl?: string | null;
  imageSource?: string | null;
```

- [ ] **Step 2: Add image column to question table**

In the question table rendering, add an image indicator column. Show a small thumbnail if `imageUrl` exists, otherwise a dash. Make the thumbnail clickable to expand.

- [ ] **Step 3: Add image filter**

Add a filter dropdown near the question table: "All" / "With Image" / "Without Image". Filter the question list by `imageUrl` presence.

- [ ] **Step 4: Add image stats to dashboard**

In the stats section, add:
- "Questions with images: X / Y (Z%)" count
- Source breakdown: Unsplash / Google / Upload / URL counts (from `imageSource` field)

These stats come from the existing admin data fetch — just need to include `imageUrl` and `imageSource` in the Prisma query and aggregate client-side.

- [ ] **Step 5: Add "Remove Image" admin action**

Add a "Remove Image" button on question detail views. On click:
- `PATCH /api/admin/questions/[id]` (or new endpoint) sets `imageUrl`, `imageSource`, `imageAttribution` to null
- If `imageSource === "upload"`, also call `del()` from `@vercel/blob` to clean up storage
- Show confirmation dialog before removing

- [ ] **Step 6: Verify build**

Run: `./node_modules/.bin/next build`

Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add image monitoring and moderation to admin dashboard"
```

---

## Task 12: Final Integration Testing + Cleanup

- [ ] **Step 1: Full build check**

Run:
```bash
npx prisma generate && ./node_modules/.bin/next build
```

Expected: Clean build, no type errors or warnings.

- [ ] **Step 2: Test mode verification**

Verify that image fields are properly threaded through test mode:
- `actAs` parameter should work with image questions
- Fake players should see images at the correct phase (after betting)

- [ ] **Step 3: Update .env.example**

Add to `.env.example`:
```
# Image Questions (all optional - feature degrades gracefully)
UNSPLASH_ACCESS_KEY=
GOOGLE_CSE_ID=
GOOGLE_CSE_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 4: Verify .gitignore includes .superpowers/**

Check that `.superpowers/` is in `.gitignore` (for brainstorming mockup files).

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore
git commit -m "feat: finalize image questions feature"
```
