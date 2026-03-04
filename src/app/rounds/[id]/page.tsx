"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import NavBar from "@/components/layout/NavBar";

export default function RoundRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roundId = params.id as string;
  const actAs = searchParams.get("actAs");

  useEffect(() => {
    fetch(`/api/rounds/${roundId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        const gameId = data.game?.id;
        if (gameId) {
          const qs = new URLSearchParams();
          qs.set("round", roundId);
          if (actAs) qs.set("actAs", actAs);
          router.replace(`/games/${gameId}?${qs.toString()}`);
        } else {
          router.replace("/dashboard");
        }
      })
      .catch(() => router.replace("/dashboard"));
  }, [roundId, actAs, router]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-[#e94560]">Loading...</div>
      </div>
    </div>
  );
}
