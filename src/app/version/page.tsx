"use client";

import { useEffect, useState } from "react";

interface VersionInfo {
  sha: string;
  shortSha: string;
  buildTime: string | null;
  env: string;
}

export default function VersionPage() {
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <p className="text-[#a0a0b8]">Loading...</p>
      </div>
    );
  }

  const githubUrl =
    info.sha !== "local"
      ? `https://github.com/zkhowes/bhutto-triv/commit/${info.sha}`
      : null;

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] border border-[#1e3a5f] rounded-xl p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-white mb-6">Bhutto Wisdom</h1>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-[#606080] uppercase tracking-wider text-xs mb-1">Commit</dt>
            <dd className="text-white font-mono">
              {githubUrl ? (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4fc3f7] hover:underline"
                >
                  {info.shortSha}
                </a>
              ) : (
                info.shortSha
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[#606080] uppercase tracking-wider text-xs mb-1">Build Time</dt>
            <dd className="text-white font-mono">
              {info.buildTime
                ? new Date(info.buildTime).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[#606080] uppercase tracking-wider text-xs mb-1">Environment</dt>
            <dd className="text-white font-mono">{info.env}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
