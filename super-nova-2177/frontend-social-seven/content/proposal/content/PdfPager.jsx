"use client";

import { useEffect, useMemo, useState } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

function pageUrl(src, page) {
  if (!src) return "";
  const [base] = src.split("#");
  return `${base}#page=${page}&zoom=page-fit&view=Fit&toolbar=0&navpanes=0&scrollbar=0&pagemode=none`;
}

export default function PdfPager({ src, title = "PDF preview", compact = false }) {
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(null);
  const framedSrc = useMemo(() => pageUrl(src, page), [page, src]);
  const viewerClass = "pdf-pager-frame block h-full w-full border-0 bg-white";

  useEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    setPage(1);
    setPageCount(null);

    fetch(src)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
      .then((buffer) => {
        if (cancelled) return;
        const text = new TextDecoder("iso-8859-1").decode(new Uint8Array(buffer));
        const matches = text.match(/\/Type\s*\/Page\b/g) || [];
        setPageCount(matches.length > 0 ? matches.length : null);
      })
      .catch(() => {
        if (!cancelled) setPageCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const move = (direction) => {
    setPage((current) => {
      const next = Math.max(1, current + direction);
      return pageCount ? Math.min(pageCount, next) : next;
    });
  };

  if (!src) return null;

  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      }}
      className={`pdf-pager ${compact ? "pdf-pager-compact" : "pdf-pager-full"} relative overflow-hidden rounded-[1rem] bg-white outline-none ring-1 ring-white/10`}
      aria-label={`${title} page viewer`}
    >
      <object
        key={framedSrc}
        data={framedSrc}
        type="application/pdf"
        aria-label={title}
        className={viewerClass}
        tabIndex={-1}
      >
        <iframe src={framedSrc} title={title} className={viewerClass} tabIndex={-1} scrolling="no" />
        <div className="flex h-56 flex-col items-center justify-center gap-3 bg-white px-4 text-center text-slate-700">
          <p className="text-sm font-semibold">PDF preview is not available in this browser.</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Open PDF
          </a>
        </div>
      </object>

      <div className="pointer-events-none absolute inset-x-0 top-2 flex items-center justify-center">
        <span className="rounded-full bg-black/55 px-2.5 py-1 text-[0.68rem] font-semibold text-white backdrop-blur">
          Page {page}{pageCount ? `/${pageCount}` : ""}
        </span>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          move(-1);
        }}
        disabled={page === 1}
        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur disabled:opacity-35"
        aria-label="Previous PDF page"
      >
        <IoChevronBack />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          move(1);
        }}
        disabled={pageCount ? page >= pageCount : false}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur disabled:opacity-35"
        aria-label="Next PDF page"
      >
        <IoChevronForward />
      </button>
    </div>
  );
}
