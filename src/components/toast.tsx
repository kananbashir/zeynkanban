"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A short message at the bottom of the screen, e.g. "Code copied." */
export function useToast() {
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: "info" | "error" = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ text, tone });
    timer.current = setTimeout(() => setMessage(null), tone === "error" ? 5000 : 3600);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { message, show };
}

export function Toast({ message }: { message: { text: string; tone: "info" | "error" } | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex justify-center lg:bottom-6">
      {message && (
        <span
          className={`max-w-[520px] rounded-2xl px-[18px] py-3 text-sm shadow-[0_12px_32px_rgba(24,35,47,0.25)] ${message.tone === "error" ? "bg-danger text-surface" : "bg-ink text-surface"}`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
