"use client";

import { useEffect, useState } from "react";

interface AutoSkipAnnouncementModalProps {
  leagueId: string;
}

export default function AutoSkipAnnouncementModal({ leagueId }: AutoSkipAnnouncementModalProps) {
  const [visible, setVisible] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/notifications/list?unread=true")
      .then((r) => r.json())
      .then((data: { notifications: Array<{ id: string; type: string; leagueId: string | null; isRead: boolean }>; total: number }) => {
        const unread = data.notifications.find(
          (n) => (n.type === "auto_skip_enabled" || n.type === "auto_skip_disabled") && n.leagueId === leagueId && !n.isRead
        );
        if (unread) {
          setNotificationId(unread.id);
          setIsEnabled(unread.type === "auto_skip_enabled");
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [leagueId]);

  const dismiss = () => {
    setVisible(false);
    if (notificationId) {
      fetch(`/api/notifications/click/${notificationId}`, { method: "POST" }).catch(() => {});
    }
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
          {isEnabled ? "24-Hour Rule is Now Active" : "24-Hour Rule Disabled"}
        </h2>

        <div className="space-y-3 overflow-y-auto min-h-0 flex-1 text-sm text-gray-400">
          {isEnabled ? (
            <>
              <p>
                Your commissioner has enabled the 24-hour rule for this league. Here&apos;s how it works:
              </p>

              <div>
                <p className="font-bold text-white">Submitting questions</p>
                <p>
                  If you&apos;re at bat and don&apos;t submit a question within 24 hours, you&apos;ll be auto-skipped. If that 24-hour mark lands inside the league&apos;s quiet hours, the skip is pushed to one hour after quiet hours end so nobody loses their turn overnight.
                </p>
                <ul className="list-disc list-inside mt-1 text-xs text-gray-500">
                  <li>First skip: you move to the end of the batting order (no point penalty)</li>
                  <li>Second skip: you lose 50% of your current points and your round is cancelled</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-white">Answering questions</p>
                <p>
                  If a question has been posted and you don&apos;t place your bet and answer within 24 hours, the round will auto-close and you&apos;ll be marked absent (same quiet-hours deferral applies). The penalty is your points divided by rounds remaining (capped at 50%).
                </p>
              </div>

              <p className="text-xs text-gray-500">
                A countdown timer in-game shows how much time you have left.
              </p>
            </>
          ) : (
            <>
              <p>
                Your commissioner has disabled the 24-hour rule for this league.
              </p>

              <div>
                <p className="font-bold text-white">What this means</p>
                <p>
                  There is no longer an automatic timer. The commissioner will manually progress the game when needed. Take your time, but don&apos;t keep everyone waiting!
                </p>
              </div>
            </>
          )}
        </div>

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
