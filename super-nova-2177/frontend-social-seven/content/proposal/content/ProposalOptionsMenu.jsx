"use client";

import Link from "next/link";
import { IoMdBookmark } from "react-icons/io";
import {
  IoChatbubbleOutline,
  IoCreateOutline,
  IoEllipsisHorizontal,
  IoPersonAddOutline,
  IoPersonCircleOutline,
  IoPersonRemoveOutline,
  IoTrashOutline,
} from "react-icons/io5";

export default function ProposalOptionsMenu({
  authorName,
  bookmarked,
  followBusy,
  followingAuthor,
  isOwner,
  menuOpen,
  onDelete,
  onEdit,
  onInviteCollab,
  onMessageAuthor,
  onProfileClick,
  onToggleBookmark,
  onToggleFollow,
  onToggleMenu,
  optionsMenuRef,
  ownerBusy,
  profileDomainHref,
  userHref,
}) {
  return (
    <div ref={optionsMenuRef} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleMenu?.();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-gray-light)] hover:bg-white/[0.07]"
        aria-label="Post options"
      >
        <IoEllipsisHorizontal />
      </button>
      {menuOpen && (
        <div className="proposal-options-menu absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-[0.9rem] border border-[var(--horizontal-line)] bg-[rgba(10,13,19,0.96)] p-1 text-[0.76rem] shadow-[var(--shadow)] backdrop-blur-xl">
          {profileDomainHref && authorName && (
            <Link
              href={userHref}
              scroll
              onClick={onProfileClick}
              className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07]"
            >
              <IoPersonCircleOutline /> View profile
            </Link>
          )}
          <button
            type="button"
            onClick={onToggleBookmark}
            className={`flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07] ${
              bookmarked ? "text-[var(--blue)]" : ""
            }`}
          >
            <IoMdBookmark /> {bookmarked ? "Saved" : "Save"}
          </button>
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07]"
              >
                <IoCreateOutline /> Edit
              </button>
              <button
                type="button"
                onClick={onInviteCollab}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07]"
              >
                <IoPersonAddOutline /> Invite collab
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={ownerBusy}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left text-[var(--pink)] hover:bg-white/[0.07] disabled:opacity-50"
              >
                <IoTrashOutline /> Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onMessageAuthor}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07]"
              >
                <IoChatbubbleOutline /> Message
              </button>
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={followBusy}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07] disabled:opacity-50"
              >
                {followingAuthor ? <IoPersonRemoveOutline /> : <IoPersonAddOutline />}
                {followingAuthor ? "Unfollow" : "Follow"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
