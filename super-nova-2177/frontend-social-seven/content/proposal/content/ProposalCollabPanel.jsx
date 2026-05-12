"use client";

import { IoClose } from "react-icons/io5";

export default function ProposalCollabPanel({
  collabBusy,
  collabError,
  collabSearch,
  collabStatus,
  collabSuggestions = [],
  onClose,
  onRequestCollab,
  onSearchChange,
}) {
  const hasSearch = collabSearch.trim();

  return (
    <div
      className="collab-invite-panel rounded-[1rem] p-3"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.78rem] font-semibold text-[var(--text-black)]">Invite collaborator</p>
          <p className="mt-0.5 text-[0.72rem] text-[var(--text-gray-light)]">
            They must approve before this post appears as a collab.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="collab-mini-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          aria-label="Close collaborator invite"
        >
          <IoClose />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={collabSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onRequestCollab(collabSuggestions[0]?.username || collabSearch);
            }
            if (event.key === "Escape") onClose();
          }}
          placeholder="Search username"
          className="collab-invite-input w-full rounded-[0.85rem] px-3 py-2 text-[0.84rem] outline-none"
        />
        {hasSearch && collabSuggestions.length > 0 && (
          <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
            {collabSuggestions.map((user) => (
              <button
                type="button"
                key={user.username}
                onClick={() => onRequestCollab(user.username)}
                disabled={collabBusy}
                className="collab-user-suggestion flex w-full items-center gap-2 rounded-[0.8rem] px-2.5 py-2 text-left disabled:opacity-55"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] text-[0.62rem] font-black uppercase">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    user.initials
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.8rem] font-semibold">@{user.username}</span>
                <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-gray-light)]">
                  {user.species}
                </span>
              </button>
            ))}
          </div>
        )}
        {hasSearch && !collabSuggestions.length && !collabBusy && (
          <p className="text-[0.72rem] text-[var(--text-gray-light)]">No matching users yet.</p>
        )}
        {collabStatus && <p className="text-[0.74rem] font-semibold text-[var(--neon-blue)]">{collabStatus}</p>}
        {collabError && <p className="text-[0.74rem] font-semibold text-[var(--pink)]">{collabError}</p>}
      </div>
    </div>
  );
}
