/* --- Global backdrop (Apple-like, light, subtle swooshes) --- */
.app-root.feed,
.app-root.portal {
  min-height: 100dvh;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
    "Segoe UI Emoji";
  color: #111827;
}

.app-root.feed {
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(0,0,0,0.03), rgba(0,0,0,0) 55%),
    radial-gradient(1200px 600px at -20% 40%, rgba(0,0,0,0.03), rgba(0,0,0,0) 60%),
    #f7f8fb;
}

/* --- Layout --- */
.feed-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 18px 16px 72px;
  position: relative;
}

.feed-sidebar {
  position: sticky;
  top: 12px;
  align-self: start;
  background: #f2f4f8;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 12px;
}

.sb-title { font-weight: 700; margin-bottom: 8px; }
.sb-line { height: 1px; background: rgba(0,0,0,0.08); margin: 10px 0; }
.sb-caption { font-size: 12px; color: #6b7280; }

.portal-chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.12);
  background: #ffffff;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}
.portal-chip:hover {
  box-shadow: 0 0 0 4px rgba(124,131,255,0.18) inset;
}

.feed-stream {
  display: grid;
  gap: 18px;
}

/* --- Frosted 2D cards that still show the background grid between them --- */
.card {
  position: relative;
  border-radius: 16px;
  padding: 14px 14px 12px;
  background: rgba(255,255,255,0.65);
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.7) inset,
    0 12px 30px rgba(0,0,0,0.07);
  backdrop-filter: blur(12px) saturate(115%);
  -webkit-backdrop-filter: blur(12px) saturate(115%);
  transform-origin: 50% 40%;
  animation: cardPop 320ms ease-out both;
}
@keyframes cardPop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.card-h { display: flex; align-items: center; gap: 6px; color: #e5e7eb; }
.card-user { font-weight: 700; color: #111; }
.card-demo { color: #6b7280; font-size: 12px; }
.card-dot { color: #9ca3af; }

.card-title {
  margin: 6px 0 10px;
  font-size: 18px;
  color: #111827;
}

/* Glassy "media" area with gentle sheen and a hint of grid */
.card-media {
  position: relative;
  height: 160px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.06);
  background: linear-gradient(120deg, rgba(124,131,255,0.12), rgba(255,255,255,0.25));
}
.media-sheen {
  position: absolute; inset: 0;
  background: radial-gradient(120% 100% at 0% 0%, rgba(255,255,255,0.65), rgba(255,255,255,0) 60%),
              radial-gradient(140% 110% at 110% 30%, rgba(124,131,255,0.15), rgba(255,255,255,0) 55%);
  mix-blend-mode: screen;
}
.grid-frost {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.38) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.38) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.35;
  filter: blur(0.2px);
}

.card-f { display: flex; gap: 8px; margin-top: 10px; }
.pill {
  height: 30px; padding: 0 12px; border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.12);
  background: #fff; cursor: pointer; font-weight: 600;
}
.pill:hover { box-shadow: 0 0 0 3px rgba(124,131,255,0.18) inset; }

/* --- Suck into bright white void transition --- */
.is-sucking .card { pointer-events: none; }
.suck-to-void {
  animation: suck 1000ms cubic-bezier(.2,.8,.2,1) forwards;
}
@keyframes suck {
  0%   { transform: translateY(0) scale(1); filter: blur(0px); opacity: 1; }
  40%  { transform: translateY(-42vh) scale(0.92); filter: blur(2px); }
  70%  { transform: translateY(-56vh) scale(0.7);  filter: blur(4px); }
  100% { transform: translateY(-70vh) scale(0.2);  filter: blur(8px); opacity: 0; }
}

.void-wash {
  position: fixed; inset: 0;
  background: radial-gradient(120% 100% at 50% -10%, #ffffff 30%, rgba(255,255,255,0.92) 60%, rgba(255,255,255,0.85));
  pointer-events: none;
  animation: washIn 900ms ease-out forwards;
}
@keyframes washIn {
  from { opacity: 0; } to { opacity: 1; }
}

/* --- 3D world overlay bits --- */
.world-root { position: fixed; inset: 0; }
.world-canvas { width: 100%; height: 100%; display: block; }
.back-pill {
  position: fixed; top: 12px; left: 12px; z-index: 10;
  height: 32px; padding: 0 12px; border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.15);
  background: #fff; cursor: pointer; font-weight: 700;
}
.world-title {
  position: fixed; top: 12px; left: 126px; z-index: 10; font-weight: 700;
  padding: 6px 10px; border-radius: 999px; background: rgba(0,0,0,0.05);
}
.tile-label {
  font-size: 12px; font-weight: 700; color: #111827;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 999px; padding: 4px 8px;
  white-space: nowrap;
}

/* Small screens still fine (no mobile diff requested, just a tiny guard) */
@media (max-width: 900px) {
  .feed-layout { grid-template-columns: 1fr; }
  .feed-sidebar { position: static; }
}
