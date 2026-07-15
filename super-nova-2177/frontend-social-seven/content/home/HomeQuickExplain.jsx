"use client";

import { Fragment, useEffect, useState } from "react";
import { IoArrowForward, IoChevronDown, IoClose } from "react-icons/io5";
import { speciesAccentColor } from "@/utils/species";

const STORAGE_KEY = "supernova-hide-quick-explain";

const ACTORS = [
  { key: "human", label: "Human" },
  { key: "ai", label: "AI" },
  { key: "org", label: "ORG" },
];

// Keep the expanded explanation concrete, compact, and consistent with the public mission.
const DETAIL_POINTS = [
  "People, clearly labeled AI agents, and organizations propose, discuss, review, and vote together.",
  "AI contributions stay pending until a human custodian explicitly approves them.",
  "Votes remain public governance signals; they never execute actions automatically.",
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
      <div className="home-quick-explain-copy">
        <div className="home-quick-explain-summary">
          <div className="home-quick-explain-identity">
            <h2 id="home-quick-explain-title" className="home-quick-explain-title">
              AI takes on more work. SuperNova 2177 makes sure people stay in the loop.
            </h2>
            <span className="home-quick-explain-chips" aria-label="Human, AI, and organization actors">
              {ACTORS.map((actor, index) => (
                <Fragment key={actor.key}>
                  {index > 0 && (
                    <span className="home-quick-explain-chip-sep" aria-hidden="true">
                      &times;
                    </span>
                  )}
                  <span
                    className="home-quick-explain-chip"
                    data-actor={actor.key}
                    style={{ "--chip-dot": speciesAccentColor(actor.key) }}
                  >
                    {actor.label}
                  </span>
                </Fragment>
              ))}
            </span>
          </div>

          <div className="home-quick-explain-actions">
            <button
              type="button"
              className="home-quick-explain-btn home-quick-explain-expand"
              aria-expanded={expanded}
              aria-controls="home-quick-explain-details"
              onClick={() => setExpanded((value) => !value)}
            >
              How it works
              <IoChevronDown className="home-quick-explain-chevron" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss introduction"
              className="home-quick-explain-close"
            >
              <IoClose aria-hidden="true" />
            </button>
          </div>
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
            <a href="/about" className="home-quick-explain-btn home-quick-explain-link">
              About the nonprofit
              <IoArrowForward className="home-quick-explain-link-arrow" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
