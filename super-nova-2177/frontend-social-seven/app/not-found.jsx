import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 py-16 text-[var(--text-black)]">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/10 shadow-[var(--shadow-pink)]">
          <span className="loading-spinner-glyph h-10 w-10" role="img" aria-label="SuperNova" />
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-[var(--pink)]">
          SuperNova 404
        </p>
        <h1 className="text-3xl font-black">This signal is not here.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--text-gray-light)]">
          The page may have moved, or the link may be private, expired, or mistyped.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-[var(--pink)] px-5 py-3 text-sm font-black text-white shadow-[var(--shadow-pink)]"
          >
            Return home
          </Link>
          <Link
            href="/universe"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm"
          >
            Open constellation
          </Link>
        </div>
      </div>
    </section>
  );
}
