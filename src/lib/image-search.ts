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
