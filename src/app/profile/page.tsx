"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import NavBar from "@/components/layout/NavBar";
import Avatar from "@/components/ui/Avatar";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
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
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-[#e94560]">Loading...</div></div>}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notificationPreference, setNotificationPreference] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            setAvatarUrl(data.avatarUrl || null);
            setNotificationPreference(data.notificationPreference ?? null);
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [session]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Center crop
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setAvatarUrl(dataUrl);
    };
    img.src = URL.createObjectURL(file);
  };

  const generateAiAvatar = async () => {
    if (!aiDescription.trim()) return;
    setGeneratingAvatar(true);
    try {
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAvatarUrl(data.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate avatar");
    } finally {
      setGeneratingAvatar(false);
    }
  };

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
        body: JSON.stringify({
          nickname: nickname.trim(),
          phoneNumber: phoneNumber.trim(),
          timezone,
          avatarUrl,
          notificationPreference,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      // Refresh the session so profileComplete is updated before redirect
      await updateSession();

      router.push(returnTo || "/dashboard");
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

  const isIncomplete = !session?.user?.profileComplete;
  const phoneMissing = isIncomplete && !phoneNumber.trim();

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          {isIncomplete ? "Complete Your Profile" : "Edit Profile"}
        </h1>
        <p className="text-[#a0a0b8] text-sm mb-4">
          Set up your display name and preferences.
        </p>

        {isIncomplete && (
          <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">⚠️</span>
              <div className="flex-1">
                <p className="text-amber-300 font-medium text-sm">
                  Add your phone number to keep playing
                </p>
                <p className="text-amber-300/80 text-xs mt-1 leading-relaxed">
                  We need your phone to keep you in the game when it&apos;s
                  your turn. Don&apos;t want texts? Pick{" "}
                  <span className="font-semibold">None</span> under
                  Notification Preference below — your phone stays on file but
                  we won&apos;t SMS you.
                </p>
                {returnTo && (
                  <p className="text-amber-300/60 text-xs mt-2">
                    You&apos;ll head back to where you were after saving.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Section */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-3">
              Avatar
            </label>
            <div className="flex items-center gap-4 mb-3">
              <Avatar src={avatarUrl} name={nickname} size="lg" />
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs w-full"
                >
                  Upload Photo
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-xs text-red-400 hover:text-red-300 w-full"
                  >
                    Remove Avatar
                  </button>
                )}
              </div>
            </div>
            {/* AI Generate */}
            <div className="flex gap-2">
              <input
                type="text"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                className="input-field flex-1 text-sm"
                placeholder="Describe your avatar (e.g. 'Purple Chicken')"
              />
              <button
                type="button"
                onClick={generateAiAvatar}
                disabled={generatingAvatar || !aiDescription.trim()}
                className="btn-secondary text-xs whitespace-nowrap"
              >
                {generatingAvatar ? "..." : "AI Generate"}
              </button>
            </div>
          </div>

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
              Phone Number *{" "}
              {phoneMissing && (
                <span className="ml-1 text-amber-400">← required</span>
              )}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={`input-field ${
                phoneMissing
                  ? "ring-2 ring-amber-500/60 border-amber-500/60"
                  : ""
              }`}
              placeholder="+1 (555) 123-4567"
              autoFocus={phoneMissing}
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

          {/* Notification Preferences */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
              Notification Preference
            </label>
            <p className="text-xs text-[#666680] mb-2">
              Override the league notification setting for your account. In-app notifications always appear in the bell.
            </p>
            <div className="space-y-2">
              {[
                { value: null, label: "Use League Default", desc: "Follow whatever the commissioner has set for the league" },
                { value: "none", label: "None", desc: "In-app only – suppress all SMS" },
                { value: "low", label: "Low", desc: "Minimum SMS to keep you in the game" },
                { value: "high", label: "High", desc: "All notifications including round results and deadline warnings" },
              ].map((opt) => (
                <label
                  key={opt.value ?? "default"}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    notificationPreference === opt.value
                      ? "border-[#e94560] bg-[#e94560]/10"
                      : "border-[#1e3a5f] hover:border-[#4fc3f7]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="notificationPreference"
                    checked={notificationPreference === opt.value}
                    onChange={() => setNotificationPreference(opt.value)}
                    className="mt-0.5 accent-[#e94560]"
                  />
                  <div>
                    <span className="text-white text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-[#a0a0b8] block mt-0.5">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
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
