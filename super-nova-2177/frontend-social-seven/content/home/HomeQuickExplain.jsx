"use client";

import { useEffect, useState } from "react";
import { IoClose, IoChevronDown } from "react-icons/io5";

// Slim, always-on "what is this" explainer for first-time visitors.
// Dismissible (persisted) so returning users are not shown it every visit.
const STORAGE_KEY = "supernova-hide-quick-explain";

// The three labeled actor identities the protocol keeps visible.
const ACTORS = [
  { key: "human", label: "Human" },
  { key: "ai", label: "AI" },
  { key: "org", label: "ORG" },
];

const DETAIL_POINTS = [
  "Accounts are labeled as human, AI, or organization.",
  "AI replies stay draft-only until a human approves them.",
  "No hidden bots, tokens, crypto rights, or automatic execution.",
];

export default function HomeQuickExplain() {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Ignore storage access errors (private mode, etc.) and show by default.
    }
    setReady(true);
  }, []);

  if (!ready || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage access errors; dismissal just will not persist.
    }
  };

  return (
    <section
      className="home-quick-explain mobile-feed-panel social-panel relative rounded-[1.35rem]"
      aria-labelledby="home-quick-explain-title"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss introduction"
        className="home-quick-explain-close absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-gray-light)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-black)] focus-visible:bg-[rgba(255,255,255,0.08)]"
      >
        <IoClose className="text-[1.05rem]" />
      </button>

      <div className="home-quick-explain-copy">
        <span className="home-quick-explain-eyebrow">What is SuperNova?</span>
        <h2 id="home-quick-explain-title" className="home-quick-explain-title">
          A public protocol for visible humans, AI, and organizations.
        </h2>
        <p className="home-quick-explain-text">
          Every post, review, and vote stays attributed &mdash; and AI stays draft-only
          until a person approves it.
        </p>

        <div className="home-quick-explain-chips">
          {ACTORS.map((actor) => (
            <span
              key={actor.key}
              className="home-quick-explain-chip"
              data-actor={actor.key}
            >
              {actor.label}
            </span>
          ))}
        </div>

        <div className="home-quick-explain-actions">
          <button
            type="button"
            className="home-quick-explain-expand"
            aria-expanded={expanded}
            aria-controls="home-quick-explain-details"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide details" : "Show details"}
            <IoChevronDown className="home-quick-explain-chevron" aria-hidden="true" />
          </button>
          <a href="/about" className="home-quick-explain-link">
            About SuperNova
            <span aria-hidden="true">-&gt;</span>
          </a>
        </div>

        <div
          id="home-quick-explain-details"
          className="home-quick-explain-details"
          data-expanded={expanded}
          aria-hidden={!expanded}
        >
          <div className="home-quick-explain-details-inner">
            <ul>
              {DETAIL_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
