"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Login Error</h1>
        <p className="text-white mb-2">Error code: <code className="bg-[#1a1a2e] px-2 py-1 rounded">{error || "unknown"}</code></p>
        <p className="text-[#a0a0b8] text-sm mb-6">
          {error === "OAuthCallback" && "The login provider returned an error. This may be a configuration issue."}
          {error === "OAuthSignin" && "Could not start the sign-in flow. Provider may be misconfigured."}
          {error === "OAuthAccountNotLinked" && "This email is already associated with a different sign-in method."}
          {error === "Callback" && "Error during the authentication callback."}
          {!["OAuthCallback", "OAuthSignin", "OAuthAccountNotLinked", "Callback"].includes(error || "") && "An unexpected error occurred during sign-in."}
        </p>
        <a href="/" className="btn-primary inline-block">Back to Home</a>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-[#e94560]">Loading...</div></div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
