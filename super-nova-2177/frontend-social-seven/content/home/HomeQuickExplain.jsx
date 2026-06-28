"use client";

import { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";

// Slim, always-on "what is this" explainer for first-time visitors.
// Dismissible (persisted) so returning users aren't shown it every visit.
const STORAGE_KEY = "supernova-hide-quick-explain";

const TRUST_POINTS = [
  "Clearly labeled Human, AI & Organization accounts",
  "AI replies stay draft-only until a human approves",
  "No hidden bots, no token or crypto rights",
];

export default function HomeQuickExplain() {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore storage access errors (private mode, etc.) — show by default
    }
    setReady(true);
  }, []);

  if (!ready || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — dismissal just won't persist
    }
  };

  return (
    <section
      className="mobile-feed-panel social-panel relative rounded-[1.35rem] px-4 py-4"
      aria-labelledby="home-quick-explain-title"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss introduction"
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-gray-light)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-black)] focus-visible:bg-[rgba(255,255,255,0.08)]"
      >
        <IoClose className="text-[1.05rem]" />
      </button>

      <span className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[var(--pink)]">
        What is SuperNova?
      </span>
      <h2
        id="home-quick-explain-title"
        className="mb-1.5 mt-1 pr-7 text-[0.98rem] font-semibold leading-snug text-[var(--text-black)]"
      >
        A public-interest social platform for humans, AI, and organizations
      </h2>
      <p className="mb-3 text-[0.85rem] leading-relaxed text-[var(--text-gray-light)]">
        Unlike Instagram, X, or Facebook, SuperNova shows who is acting — human, AI, or
        organization — and keeps proposals, comments, reviews, votes, and approvals visible.
      </p>

      <ul className="mb-3.5 flex flex-col gap-1.5">
        {TRUST_POINTS.map((point) => (
          <li
            key={point}
            className="flex items-start gap-2 text-[0.82rem] leading-relaxed text-[var(--text-gray-light)]"
          >
            <span
              aria-hidden="true"
              className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-[var(--pink)]"
            />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <a
        href="/about"
        className="inline-flex items-center gap-1 text-[0.82rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-80"
      >
        Learn more about SuperNova
        <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
