"use client";

import { useEffect, useState } from "react";

const FEATURES = [
  {
    title: "Busted but Not Out",
    description:
      "Hit zero? Keep answering. Every correct answer earns +1 bonus, and those bonuses become your starting points in the next game of the season.",
  },
  {
    title: "24-Hour Auto-Skip",
    description:
      "Rounds now advance automatically if someone goes quiet too long, with a heads-up warning first. Commissioners can toggle the rule and players see a countdown in-game.",
  },
  {
    title: "Pause Yourself Between Games",
    description:
      "Sitting one out? You no longer need a commissioner. Pause and unpause your own slot from the league page between games.",
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
