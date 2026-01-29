"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/users/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data) {
            setNickname(data.nickname || session.user?.name || "");
            setPhoneNumber(data.phoneNumber || "");
            setTimezone(data.timezone || "America/Los_Angeles");
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Nickname is required");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), phoneNumber: phoneNumber.trim(), timezone }),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      router.push("/dashboard");
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#e94560]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          {session?.user?.profileComplete ? "Edit Profile" : "Complete Your Profile"}
        </h1>
        <p className="text-[#a0a0b8] text-sm mb-6">
          Set up your display name and preferences.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
              Nickname *
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input-field"
              placeholder="Your display name"
              maxLength={30}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="input-field"
              placeholder="+1 (555) 123-4567"
            />
            <p className="mt-1.5 text-xs text-[#666680]">
              We only use your phone number for game notifications and do not
              share it with any other entity.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input-field"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving
              ? "Saving..."
              : session?.user?.profileComplete
                ? "Save Changes"
                : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
