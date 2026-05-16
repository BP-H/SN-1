"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }) {
  const digest = error?.digest ? `Reference ${error.digest}` : null;

  return (
    <section className="release-state-page">
      <div className="release-state-card">
        <div className="release-state-mark">
          <span className="loading-spinner-glyph h-10 w-10" role="img" aria-label="SuperNova" />
        </div>
        <p className="release-state-eyebrow">SuperNova</p>
        <h1 className="release-state-title">Something slipped out of orbit.</h1>
        <p className="release-state-copy">
          The app hit a temporary error. You can try again or return to the live network.
        </p>
        {digest && <p className="release-state-reference">{digest}</p>}
        <div className="release-state-actions">
          <button
            type="button"
            onClick={reset}
            className="release-state-action release-state-action-primary"
          >
            Retry
          </button>
          <Link
            href="/"
            className="release-state-action release-state-action-secondary"
          >
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
