# Image Questions Design Spec

> Date: 2026-03-23
> Status: Approved

## Overview

Add optional image attachment support to trivia questions. Players can attach an image via built-in search (Unsplash + Google), device upload, or URL paste. The Question Lab AI suggests images for visual questions. Images are revealed with the question text after bets lock.

## Data Model

### Schema Changes

**Question model** -- add three nullable fields:
```prisma
imageUrl         String?   // External URL or Vercel Blob URL
imageSource      String?   // "unsplash" | "google" | "upload" | "url"
imageAttribution String?   // JSON: {"name":"...","profileUrl":"..."} for Unsplash ToS compliance
```

**QuestionDraft model** -- same three fields:
```prisma
imageUrl         String?
imageSource      String?
imageAttribution String?
```

No new models. Image is a property of the question, not a separate entity.

### Image Storage Strategy

| Source | Storage | URL Pattern |
|--------|---------|-------------|
| Unsplash search | Hotlinked (their CDN) | `images.unsplash.com/...` |
| Google search | Hotlinked (original source) | Varies |
| Device upload | Vercel Blob | `*.public.blob.vercel-storage.com/...` |
| URL paste | Hotlinked (user-provided) | Varies |

Only device uploads consume storage. Unsplash/Google results are served from their original URLs. Keeps Vercel Blob usage minimal.

## API Routes

### `POST /api/images/search`

Unified image search endpoint.

- **Auth**: NextAuth session required
- **Rate limit**: 10 req/min per user
- **Body**: `{ query: string, source: "unsplash" | "google" }`
- **Response**: `{ results: { url: string, thumbnail: string, attribution?: string }[] }`
- Search query auto-seeded from question text, editable by player
- Unsplash is the default tab; Google Custom Search is the "Web Search" fallback

### `POST /api/images/upload`

Device upload via Vercel Blob.

- **Auth**: NextAuth session required
- **Rate limit**: 5 req/min per user
- **Accepts**: Multipart form data (image file)
- **Validation**:
  - Max 5MB file size, max 4096x4096 dimensions
  - Allowed types: jpg/png/gif/webp
  - Validate both `Content-Type` header AND file magic bytes (use `file-type` package)
  - Reject files that don't match an image signature regardless of extension
- **Response**: `{ url: string }`

### URL Validation (paste source)

User-provided URLs must pass validation before storage:
- Must be `https://` only (block `http://`, `javascript:`, `data:`, `blob:`, `file:`)
- Must parse successfully via `new URL()`
- Server-side HEAD request to verify response has an image `Content-Type`

### Environment Variables

- `UNSPLASH_ACCESS_KEY` -- free tier: 50 req/hr (demo), 5000 req/hr (production approval, free)
- `GOOGLE_CSE_ID` + `GOOGLE_CSE_API_KEY` -- 100 free queries/day via existing Google Cloud project
- `BLOB_READ_WRITE_TOKEN` -- Vercel Blob storage token (create in Vercel dashboard under Storage)

Both search APIs gracefully degrade: if keys are missing, that search tab is hidden. The feature works with just upload + URL paste even with zero API keys configured. Vercel Blob token is required only if device upload is desired.

## UI Components

### `ImageAttachment.tsx` (new)

The "Add Image" toggle + preview that lives in QuestionSubmitForm.

- **Collapsed state (default)**: "Add Image" button
- **Expanded state**: attached image preview with remove/change buttons
- Manages `imageUrl` + `imageSource` + `imageAttribution` state, passed up to parent form
- Broken image fallback: `onError` handler hides the image and shows a subtle "Image unavailable" placeholder

### `ImageSearchModal.tsx` (new)

Full search/upload/paste modal.

- **Tabs**: "Unsplash" and "Web Search" (only shown if respective API keys exist)
- **Search input**: pre-filled from question text, editable
- **Results grid**: 3-column (2-column on mobile), tappable thumbnails
- **Upload**: "Upload from Device" button triggers native file picker
- **URL paste**: collapsible input at bottom
- **Mobile**: full-screen modal on small viewports, sticky search bar, large touch targets

### Integration Points

**QuestionSubmitForm** (`src/components/question/QuestionSubmitForm.tsx`):
- `ImageAttachment` placed below question text field, above answer format tabs
- `imageUrl` + `imageSource` + `imageAttribution` included in question submission payload

**POST /api/questions route** (`src/app/api/questions/route.ts`):
- Accept `imageUrl`, `imageSource`, `imageAttribution` in request body
- Pass through to `submitQuestion()` in game-engine

**submitQuestion() in game-engine** (`src/lib/game-engine.ts`):
- Accept and persist `imageUrl`, `imageSource`, `imageAttribution` when creating the Question record

**GET /api/rounds/[id] route** (`src/app/api/rounds/[id]/route.ts`):
- Strip `imageUrl` from the question object when the player has not yet placed a bet (same code path that currently hides `questionText`). The image IS the question for visual trivia -- leaking it during betting defeats the purpose.

**WorkshopEmbed / WorkshopPage** (`src/components/question/WorkshopEmbed.tsx`, `src/app/questions/workshop/page.tsx`):
- `QuestionPreviewCard` shows optional image preview when `imageSearchTerm` is present
- AI auto-searches on card generation; result shown as preview
- Clicking the image opens `ImageSearchModal` to swap it
- `onSelectQuestion` callback type updated to include `imageUrl`, `imageSource`, `imageAttribution`
- When player selects a card, image fields carry through to the form

**AnswerInterface** (`src/components/game/AnswerInterface.tsx`):
- If `question.imageUrl` exists, render above question text
- Use Next.js `<Image>` with `unoptimized` for external URLs
- Responsive sizing, rounded corners, tap to expand on mobile
- Broken image fallback: `onError` hides image, shows "Image unavailable" placeholder
- If `imageAttribution` exists (Unsplash), show small credit line below image

**RoundResults** (`src/components/game/RoundResults.tsx`):
- Show image in question reveal section after round closes

**QuestionDraft API** (`src/app/api/questions/drafts/route.ts`):
- `imageUrl`, `imageSource`, `imageAttribution` included in draft save/load
- Add all three fields to the `allowedFields` array for PUT updates

**next.config.js**:
- Add `remotePatterns` for `images.unsplash.com` and `*.public.blob.vercel-storage.com` so `<Image>` optimization works for known domains. Use `unoptimized` only for unknown external URLs (Google search results, URL paste).

### No Changes Needed

- **Betting interface**: no image shown during betting phase (just category + format as today)
- **Grading interface**: graders see question text; image is context, not grading input
- **Scoring / game engine / round close**: image is display-only, no impact on game mechanics

## Question Lab AI Integration

### Workshop Variation Type

Add `imageSearchTerm` field to the `WorkshopVariation` type (nullable string).

### System Prompt Changes (`src/lib/ai.ts`)

Update `workshopQuestion()` system prompt to:
- Include `imageSearchTerm` in the JSON output schema
- Instruct AI to populate it when the question is visual (identify person/place/thing, "what does X look like", etc.)
- AI should actively look for opportunities to suggest image-based questions to increase the "joy factor"

### Workshop UI Flow

1. AI generates 3 variations; some may include `imageSearchTerm`
2. For cards with `imageSearchTerm`, workshop auto-calls `/api/images/search` with that term
3. First result thumbnail shown as preview on the card
4. Player can click to open search modal and pick a different image, or remove it
5. On card selection, image carries through to the question form

## Admin Integration

### Question Bank Table (`/admin`)

- Add image indicator column (thumbnail icon, expandable on click)
- Add filter: "has image" / "no image" / "all"

### Stats Dashboard

- Total questions with images vs without
- Image source breakdown (Unsplash / Google / upload / URL paste) -- powered by `imageSource` field
- Adoption trend over time

### Question Detail View

- Image renders inline alongside question text, answer options, and grading info

### Moderation

- "Remove Image" action on question detail: sets `imageUrl` to null without deleting the question
- When `imageSource === "upload"`, also call `del()` from `@vercel/blob` to clean up the stored file
- Admin can remove inappropriate images without affecting the rest of the question/round

## Gameplay Flow

```
At-bat player creates question
  ├── Writes question text
  ├── Optionally clicks "Add Image"
  │   ├── Search (Unsplash / Google) -- seeded from question text
  │   ├── Upload from device
  │   └── Paste URL
  ├── Selects answer format (MC / Free Text / PiR)
  └── Submits question

Category revealed (betting phase)
  └── Players see: category + answer format (NO image, NO question text)

Bets locked → Question + image revealed
  └── Players see: image + question text + answer options
  └── Timer starts

Round closes → Results
  └── Image shown in question reveal alongside correct answer
```

## Technical Notes

- External image URLs may break if the source removes them. This is acceptable -- the question text should still make sense without the image. No need to cache/proxy external images. UI shows a graceful "Image unavailable" fallback.
- Unsplash requires attribution per their API terms. `imageAttribution` field stores photographer name and profile URL as JSON. Display a small credit line below the image in gameplay views.
- Vercel Blob uploads are permanent unless explicitly deleted. Admin "Remove Image" cleans up uploads; no background cleanup job needed.
- Image rendering: use Next.js `<Image>` with `remotePatterns` for known domains (Unsplash, Vercel Blob). Use `unoptimized` for unknown external URLs (Google results, URL paste).
- Workshop auto-search: only auto-search for the first card with an `imageSearchTerm` to conserve rate limits. Lazy-load images for other cards on expand/hover.
