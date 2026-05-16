import Link from "next/link";

export default function NotFound() {
  return (
    <section className="release-state-page">
      <div className="release-state-card">
        <div className="release-state-mark">
          <span className="loading-spinner-glyph h-10 w-10" role="img" aria-label="SuperNova" />
        </div>
        <p className="release-state-eyebrow">SuperNova 404</p>
        <h1 className="release-state-title">This signal is not here.</h1>
        <p className="release-state-copy">
          The page may have moved, or the link may be private, expired, or mistyped.
        </p>
        <div className="release-state-actions">
          <Link
            href="/"
            className="release-state-action release-state-action-primary"
          >
            Home
          </Link>
          <Link
            href="/universe"
            className="release-state-action release-state-action-secondary"
          >
            Constellation
          </Link>
        </div>
      </div>
    </section>
  );
}
