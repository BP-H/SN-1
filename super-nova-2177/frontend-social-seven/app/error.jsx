"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }) {
  const digest = error?.digest ? `Reference ${error.digest}` : null;

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 py-16 text-[var(--text-black)]">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/10 shadow-[var(--shadow-pink)]">
          <span className="loading-spinner-glyph h-10 w-10" role="img" aria-label="SuperNova" />
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-[var(--pink)]">
          SuperNova
        </p>
        <h1 className="text-3xl font-black">Something slipped out of orbit.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--text-gray-light)]">
          The app hit a temporary error. You can try again or return to the live network.
        </p>
        {digest && (
          <p className="mt-4 text-xs font-semibold text-[var(--text-gray-light)]">{digest}</p>
        )}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[var(--pink)] px-5 py-3 text-sm font-black text-white shadow-[var(--shadow-pink)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm"
          >
            Return home
          </Link>
        </div>
      </div>
    </section>
  );
}
