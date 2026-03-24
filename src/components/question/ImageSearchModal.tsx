"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ImageResult {
  url: string;
  thumbnail: string;
  attribution?: {
    name: string;
    profileUrl: string;
  };
}

interface SelectedImage {
  url: string;
  source: "unsplash" | "google" | "upload" | "url";
  attribution?: string;
}

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: SelectedImage) => void;
  initialQuery: string;
}

export default function ImageSearchModal({
  isOpen,
  onClose,
  onSelect,
  initialQuery,
}: ImageSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searchAvailable, setSearchAvailable] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<SelectedImage | null>(null);

  // Upload state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL paste state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  // Fetch available sources on open
  useEffect(() => {
    if (!isOpen) return;
    setSourcesLoaded(false);
    fetch("/api/images/search")
      .then((r) => r.json())
      .then((data: { sources: ("unsplash" | "google")[] }) => {
        const srcs = data.sources ?? [];
        setSearchAvailable(srcs.includes("unsplash"));
        setSourcesLoaded(true);
      })
      .catch(() => {
        setSearchAvailable(false);
        setSourcesLoaded(true);
      });
  }, [isOpen]);

  // Run initial search when sources load and we have a query
  useEffect(() => {
    if (!sourcesLoaded || !isOpen) return;
    if (searchAvailable && query.trim()) {
      runSearch("unsplash", query.trim());
    }
  }, [sourcesLoaded, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setResults([]);
      setSelected(null);
      setSearchError("");
      setUploadError("");
      setUrlError("");
      setPasteUrl("");
      setShowUrlInput(false);
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const runSearch = useCallback(
    async (source: "unsplash" | "google", q: string) => {
      if (!q.trim()) return;
      setSearchLoading(true);
      setSearchError("");
      setResults([]);
      try {
        const res = await fetch("/api/images/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q.trim(), source }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setResults(data.results ?? []);
        if ((data.results ?? []).length === 0) {
          setSearchError("No results found. Try a different search term.");
        }
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setSearchLoading(false);
      }
    },
    []
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !searchAvailable) return;
    runSearch("unsplash", query);
  };

  const handleImageSelect = (result: ImageResult, source: "unsplash" | "google") => {
    const img: SelectedImage = {
      url: result.url,
      source,
    };
    if (source === "unsplash" && result.attribution) {
      img.attribution = JSON.stringify(result.attribution);
    }
    setSelected(img);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSelected({ url: data.url, source: "upload" });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError("");

    if (!pasteUrl.trim()) return;

    if (!pasteUrl.trim().startsWith("https://")) {
      setUrlError("URL must start with https://");
      return;
    }

    setUrlLoading(true);
    try {
      const res = await fetch("/api/images/validate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pasteUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid URL");
      setSelected({ url: data.url, source: "url" });
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Could not validate URL");
    } finally {
      setUrlLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:flex md:items-center md:justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Modal body */}
        <div
          className="
            fixed inset-0 z-50 bg-[#0a0a1a] flex flex-col overflow-hidden
            md:static md:inset-auto md:rounded-xl md:border md:border-[#1e3a5f]
            md:max-w-2xl md:w-full md:max-h-[90vh] md:shadow-2xl
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3a5f] flex-shrink-0 bg-[#0f0f23]">
            <h2 className="text-base font-semibold text-white">Add Image</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#a0a0b8] hover:text-white hover:bg-[#1e3a5f] transition-colors"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M1 1l16 16M17 1L1 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Sticky search bar */}
          <div className="px-4 pt-3 pb-3 border-b border-[#1e3a5f] flex-shrink-0 bg-[#0a0a1a]">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for images..."
                className="
                  flex-1 bg-[#0f0f23] border border-[#1e3a5f] rounded-lg px-3 py-2.5
                  text-sm text-white placeholder-[#666680] outline-none
                  focus:border-[#4a9eff] transition-colors
                "
              />
              <button
                type="submit"
                disabled={searchLoading || !query.trim() || !searchAvailable}
                className="
                  px-4 py-2.5 bg-[#4a9eff] text-white text-sm font-medium rounded-lg
                  hover:bg-[#3a8eef] disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors whitespace-nowrap
                "
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </form>

            {sourcesLoaded && !searchAvailable && (
              <p className="text-xs text-[#666680] mt-2">
                Image search is unavailable. Use upload or URL paste below.
              </p>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {/* Search results grid */}
            {(searchLoading || results.length > 0 || searchError) && (
              <div>
                {searchLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#4a9eff] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {!searchLoading && searchError && (
                  <div className="text-center py-8 text-[#a0a0b8] text-sm">
                    {searchError}
                  </div>
                )}

                {!searchLoading && results.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {results.map((result, idx) => {
                      const isSelected =
                        selected?.url === result.url &&
                        (selected.source === "unsplash" || selected.source === "google");
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleImageSelect(result, "unsplash")}
                          className={`
                            group relative rounded-lg overflow-hidden border-2 transition-all
                            aspect-square focus:outline-none
                            ${
                              isSelected
                                ? "border-[#4a9eff] ring-2 ring-[#4a9eff]/30"
                                : "border-transparent hover:border-[#2a5a8f]"
                            }
                          `}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={result.thumbnail || result.url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {/* Selection overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#4a9eff]/20 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-[#4a9eff] flex items-center justify-center">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path
                                    d="M2 7l4 4 6-6"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                          {/* Attribution overlay */}
                          {result.attribution && (
                            <div className="
                              absolute bottom-0 left-0 right-0 px-2 py-1
                              bg-gradient-to-t from-black/80 to-transparent
                              text-[10px] text-white/80 truncate
                              opacity-0 group-hover:opacity-100 transition-opacity
                            ">
                              Photo by {result.attribution.name}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[#1e3a5f]" />

            {/* Upload from device */}
            <div>
              <p className="text-xs font-medium text-[#a0a0b8] uppercase tracking-wider mb-2.5">
                Upload from Device
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="
                  w-full min-h-[44px] flex items-center justify-center gap-2
                  border border-dashed border-[#1e3a5f] rounded-lg
                  text-sm text-[#a0a0b8] hover:text-white hover:border-[#4a9eff]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors px-4 py-3
                "
              >
                {uploadLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#4a9eff] border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M9 2v10M5 6l4-4 4 4M2 14h14"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Choose image file
                  </>
                )}
              </button>
              {uploadError && (
                <p className="text-xs text-red-400 mt-1.5">{uploadError}</p>
              )}
              {selected?.source === "upload" && !uploadLoading && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-[#4a9eff]/10 border border-[#4a9eff]/30 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.url}
                    alt="Uploaded preview"
                    className="w-10 h-10 object-cover rounded"
                  />
                  <span className="text-xs text-[#4a9eff] font-medium">Image uploaded</span>
                </div>
              )}
            </div>

            {/* URL paste section */}
            <div>
              <button
                type="button"
                onClick={() => setShowUrlInput((v) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-[#a0a0b8] hover:text-white transition-colors w-full"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className={`transition-transform ${showUrlInput ? "rotate-90" : ""}`}
                >
                  <path
                    d="M5 2l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="uppercase tracking-wider">Paste URL</span>
              </button>

              {showUrlInput && (
                <form onSubmit={handleUrlSubmit} className="mt-2.5 space-y-2">
                  <input
                    type="url"
                    value={pasteUrl}
                    onChange={(e) => {
                      setPasteUrl(e.target.value);
                      setUrlError("");
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="
                      w-full bg-[#0f0f23] border border-[#1e3a5f] rounded-lg px-3 py-2.5
                      text-sm text-white placeholder-[#666680] outline-none
                      focus:border-[#4a9eff] transition-colors
                    "
                  />
                  {urlError && (
                    <p className="text-xs text-red-400">{urlError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={urlLoading || !pasteUrl.trim()}
                    className="
                      w-full min-h-[44px] py-2.5 px-4 rounded-lg text-sm font-medium
                      bg-[#0f0f23] border border-[#1e3a5f] text-[#a0a0b8]
                      hover:border-[#4a9eff] hover:text-white
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                    "
                  >
                    {urlLoading ? "Validating..." : "Use this URL"}
                  </button>
                  {selected?.source === "url" && !urlLoading && (
                    <div className="flex items-center gap-2 p-2 bg-[#4a9eff]/10 border border-[#4a9eff]/30 rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selected.url}
                        alt="URL preview"
                        className="w-10 h-10 object-cover rounded"
                      />
                      <span className="text-xs text-[#4a9eff] font-medium">URL validated</span>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Bottom padding so content clears the sticky footer */}
            <div className="h-2" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#1e3a5f] flex-shrink-0 bg-[#0f0f23]">
            {selected ? (
              <div className="flex items-center gap-2 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.url}
                  alt="Selected"
                  className="w-9 h-9 object-cover rounded flex-shrink-0"
                />
                <span className="text-xs text-[#a0a0b8] truncate">
                  {selected.source === "upload"
                    ? "Uploaded image"
                    : selected.source === "url"
                    ? "Pasted URL"
                    : "Search result"}
                </span>
              </div>
            ) : (
              <span className="text-xs text-[#666680]">No image selected</span>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="
                flex-shrink-0 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold
                bg-[#4a9eff] text-white hover:bg-[#3a8eef]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              Use Selected Image
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
