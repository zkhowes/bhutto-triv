"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";

interface ShareData {
  type: string;
  league: {
    id: string;
    name: string;
    type: string;
    inviteCode: string;
  };
  entityId: string | null;
}

export default function SharePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Link not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        // Auto-redirect based on type
        switch (d.type) {
          case "invitation":
            router.push(`/leagues/join/${d.league.inviteCode}`);
            break;
          case "league":
            router.push(`/leagues/${d.league.id}`);
            break;
          case "game":
            if (d.entityId) router.push(`/games/${d.entityId}`);
            break;
          case "round":
            if (d.entityId) router.push(`/rounds/${d.entityId}`);
            break;
          case "season":
            router.push(`/leagues/${d.league.id}`);
            break;
        }
      })
      .catch(() => setError("This link is invalid or has expired."));
  }, [token, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-sm">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-[#e94560] text-xl mb-2">
          Loading...
        </div>
        {data && (
          <p className="text-[#a0a0b8] text-sm">{data.league.name}</p>
        )}
      </div>
    </div>
  );
}
