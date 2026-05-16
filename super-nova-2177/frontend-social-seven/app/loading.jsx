export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backgroundGray)] text-[var(--text-black)]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/40 bg-white/10 shadow-[var(--shadow-pink)]">
        <span className="loading-spinner-glyph h-12 w-12" role="img" aria-label="Loading" />
      </div>
    </div>
  );
}
