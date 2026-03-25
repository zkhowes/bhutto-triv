"use client";

import { useEffect, useState } from "react";

const FEATURES = [
  {
    title: "Ordering Questions",
    description:
      "A new question format! Challenge players to arrange items in the right order -- chronologically, by size, by rank, you name it.",
  },
  {
    title: "Blind Bet",
    description:
      "Feeling bold? Once per game, bet before seeing the question for a 2x multiplier. Everyone will know you went blind.",
  },
  {
    title: "Smarter Question Formats",
    description:
      "The AI now helps you find the best format for your question. There's usually a more engaging option than plain text -- and converting is one tap.",
  },
  {
    title: "Image Questions",
    description:
      "Add photos to your questions. Search the web, upload from your device, or paste a URL.",
  },
  {
    title: "Interactive Demo",
    description:
      "New to the group? The landing page now has a guided walkthrough so newcomers can try the game before joining.",
  },
];

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/users/whats-new")
      .then((r) => r.json())
      .then((d) => {
        if (d.show) setVisible(true);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setVisible(false);
    fetch("/api/users/whats-new", { method: "POST" }).catch(() => {});
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={dismiss}
    >
      <div
        className="bg-[#0f0f23] border border-[#1e3a5f] rounded-xl max-w-md w-full p-6 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4 shrink-0">
          What&apos;s New in Bhutto Wisdom
        </h2>

        <ul className="space-y-3 overflow-y-auto min-h-0 flex-1">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <p className="text-sm font-bold text-white">{f.title}</p>
              <p className="text-sm text-gray-400">{f.description}</p>
            </li>
          ))}
        </ul>

        <button
          onClick={dismiss}
          className="mt-5 w-full py-2 rounded-lg font-semibold text-sm text-black bg-[#fbbf24] hover:bg-[#f59e0b] transition-colors shrink-0"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
