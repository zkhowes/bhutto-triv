"use client";

import { useState, useRef, useEffect } from "react";
import { CATEGORIES, isDefaultCategory } from "@/lib/constants";

interface CustomCategory {
  id: string;
  name: string;
  usageCount: number;
}

interface CategorySelectProps {
  value: string;
  customCategories: CustomCategory[];
  onChange: (value: string) => void;
  onError?: (msg: string) => void;
}

export default function CategorySelect({
  value,
  customCategories,
  onChange,
  onError,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const commitNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    if (trimmed.length > 50) {
      onError?.("Category name must be 50 characters or less");
      return;
    }
    if (isDefaultCategory(trimmed)) {
      onError?.(`"${trimmed}" matches a default category. Select it instead.`);
      return;
    }
    const existing = customCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    onChange(existing ? existing.name : trimmed);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`input-field text-left flex items-center justify-between w-full ${
          value ? "text-white" : "text-[#666680]"
        }`}
      >
        <span>{value || "Select a category..."}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-[#666680] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-[#1e3a5f] bg-[#0f0f23] shadow-lg">
          {/* Defaults */}
          <div className="py-1">
            <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-[#666680]">
              Defaults
            </p>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange(cat);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#1e3a5f]/50 ${
                  value === cat ? "text-white bg-[#e94560]/15" : "text-[#a0a0b8]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Custom */}
          {(customCategories.length > 0 || (value && !isDefaultCategory(value))) && (
            <div className="py-1 border-t border-[#1e3a5f]">
              <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-[#666680]">
                Custom
              </p>
              {customCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onChange(cat.name);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#1e3a5f]/50 ${
                    value === cat.name
                      ? "text-white bg-[#e94560]/15"
                      : "text-[#a0a0b8]"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              {value && !isDefaultCategory(value) && !customCategories.some((c) => c.name === value) && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-sm text-white bg-[#e94560]/15"
                >
                  {value} <span className="text-xs text-[#666680]">(new)</span>
                </button>
              )}
            </div>
          )}

          {/* Create new */}
          <div className="py-1 border-t border-[#1e3a5f]">
            {creating ? (
              <div className="px-2 py-1.5 flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNew();
                    }
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  onBlur={() => {
                    if (newName.trim()) commitNew();
                    else setCreating(false);
                  }}
                  className="input-field flex-1 text-sm"
                  placeholder="Category name"
                  maxLength={50}
                  autoFocus
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitNew}
                  className="btn-secondary text-xs px-2"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-sm text-[#4fc3f7] hover:bg-[#1e3a5f]/50 font-medium"
              >
                + Create new category
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
