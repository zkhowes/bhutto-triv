"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirect to /profile if signed in but profile incomplete.
 * Captures current path + query as ?returnTo=… so the user lands back here
 * after saving.
 *
 * No-op while session is loading or unauthenticated. Call near the top of
 * any client page that should be gated behind a complete profile.
 */
export function useRequireProfile(): void {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.profileComplete) return;

    const here =
      typeof window === "undefined"
        ? "/dashboard"
        : window.location.pathname + window.location.search;

    if (here.startsWith("/profile")) return;

    router.push(`/profile?returnTo=${encodeURIComponent(here)}`);
  }, [status, session, router]);
}
