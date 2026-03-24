"use client";

import { useState, useEffect, useMemo } from "react";
import ImageSearchModal from "./ImageSearchModal";

interface ImageAttachmentProps {
  imageUrl: string;
  imageSource: string;
  imageAttribution: string;
  questionText: string;
  onChange: (image: {
    url: string;
    source: string;
    attribution?: string;
  } | null) => void;
}

export default function ImageAttachment({
  imageUrl,
  imageSource,
  imageAttribution,
  questionText,
  onChange,
}: ImageAttachmentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const hasImage = !!imageUrl;

  // Reset broken state when imageUrl changes
  useEffect(() => { setImgBroken(false); }, [imageUrl]);

  const handleImageError = () => {
    setImgBroken(true);
  };

  // Parse attribution JSON for Unsplash display
  const parsedAttribution = useMemo(() => {
    if (imageSource !== "unsplash" || !imageAttribution) return null;
    try {
      const attr = JSON.parse(imageAttribution);
      return { name: attr.name, profileUrl: attr.profileUrl };
    } catch {
      return { name: imageAttribution, profileUrl: "https://unsplash.com" };
    }
  }, [imageSource, imageAttribution]);

  const handleSelect = (selected: {
    url: string;
    source: string;
    attribution?: string;
  }) => {
    setImgBroken(false);
    onChange(selected);
    setIsModalOpen(false);
  };

  const handleRemove = () => {
    setImgBroken(false);
    onChange(null);
  };

  return (
    <>
      {!hasImage ? (
        /* Empty state — dashed border toggle */
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full border-2 border-dashed border-[#1e3a5f] hover:border-[#4a9eff] rounded-lg px-4 py-5 flex items-center gap-3 transition-colors duration-200 group"
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0f1a2e] border border-[#1e3a5f] group-hover:border-[#4a9eff] flex items-center justify-center transition-colors duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-[#4a6fa5] group-hover:text-[#4a9eff] transition-colors duration-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
              />
            </svg>
          </div>

          <div className="flex-1 text-left">
            <span className="text-sm text-[#8ab4d4] group-hover:text-[#a8ccf0] transition-colors duration-200">
              Add Image to Question
            </span>
          </div>

          <span className="flex-shrink-0 text-[10px] font-semibold tracking-widest text-[#4a6fa5] bg-[#0f1a2e] border border-[#1e3a5f] rounded px-2 py-0.5 uppercase">
            Optional
          </span>
        </button>
      ) : (
        /* Has image state */
        <div className="rounded-lg overflow-hidden border border-[#1e3a5f] bg-[#0a0f1e]">
          {/* Image preview */}
          {imgBroken ? (
            <div className="w-full max-h-48 h-36 flex flex-col items-center justify-center gap-2 bg-[#0f1a2e]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-[#4a6fa5]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
              <span className="text-xs text-[#4a6fa5]">Image unavailable</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Question image"
              className="w-full max-h-48 object-cover rounded-t-lg"
              onError={handleImageError}
            />
          )}

          {/* Controls row */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#0a0f1e]">
            {/* Attribution */}
            <div className="flex-1 min-w-0">
              {parsedAttribution ? (
                <a
                  href={parsedAttribution.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#4a6fa5] hover:text-[#4a9eff] transition-colors duration-150 truncate block"
                >
                  Photo by {parsedAttribution.name}
                </a>
              ) : (
                <span className="text-[11px] text-[#4a6fa5] truncate block">
                  {imageSource || "Image attached"}
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs px-3 py-1 rounded-full bg-[#0f1a2e] border border-[#1e3a5f] text-[#8ab4d4] hover:border-[#4a9eff] hover:text-[#4a9eff] transition-colors duration-150"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs px-3 py-1 rounded-full bg-[#0f1a2e] border border-[#1e3a5f] text-[#8ab4d4] hover:border-red-500 hover:text-red-400 transition-colors duration-150"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageSearchModal
        isOpen={isModalOpen}
        initialQuery={questionText}
        onSelect={handleSelect}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
