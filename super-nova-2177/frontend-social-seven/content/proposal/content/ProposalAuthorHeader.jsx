"use client";

import Link from "next/link";
import { speciesAccentColor, speciesAvatarStyle } from "@/utils/species";

export default function ProposalAuthorHeader({
  authorLabel,
  authorSpecies,
  avatarApprovedCollabs = [],
  defaultAvatar,
  displayAvatar,
  extraApprovedCollabCount = 0,
  extraAvatarApprovedCollabCount = 0,
  inlineApprovedCollabs = [],
  profileDomainHref,
  time,
  userHref,
}) {
  const authorAvatarStyle = speciesAvatarStyle(authorSpecies || "human");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="proposal-author-avatar-cluster flex shrink-0 items-center">
        {profileDomainHref ? (
          <a
            href={profileDomainHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open profile domain"
            className="proposal-author-avatar-link shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={displayAvatar || defaultAvatar}
              alt="user avatar"
              onError={(event) => {
                event.currentTarget.src = defaultAvatar;
              }}
              className="h-10 w-10 rounded-full border object-cover"
              style={authorAvatarStyle}
            />
          </a>
        ) : (
          <Link
            href={userHref}
            scroll
            className="proposal-author-avatar-link shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={displayAvatar || defaultAvatar}
              alt="user avatar"
              onError={(event) => {
                event.currentTarget.src = defaultAvatar;
              }}
              className="h-10 w-10 rounded-full border object-cover"
              style={authorAvatarStyle}
            />
          </Link>
        )}
        {avatarApprovedCollabs.length > 0 && (
          <div className="proposal-approved-collab-avatars flex shrink-0 items-center -space-x-2">
            {avatarApprovedCollabs.map((collab) => (
              <Link
                key={collab.key}
                href={`/users/${encodeURIComponent(collab.username)}`}
                scroll
                onClick={(event) => event.stopPropagation()}
                className="proposal-approved-collab-avatar flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[0.56rem] font-black uppercase"
                style={{
                  ...speciesAvatarStyle(collab.species || "human"),
                  backgroundColor: speciesAccentColor(collab.species || "human"),
                }}
                title={`Approved collaborator @${collab.username}`}
              >
                {collab.avatar ? (
                  <img
                    src={collab.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  collab.username.slice(0, 2).toUpperCase()
                )}
              </Link>
            ))}
            {extraAvatarApprovedCollabCount > 0 && (
              <span className="proposal-approved-collab-avatar proposal-approved-collab-avatar-extra flex h-7 w-7 items-center justify-center rounded-full text-[0.56rem] font-black">
                +{extraAvatarApprovedCollabCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 text-[0.9rem] leading-tight">
        <div className="proposal-author-inline-line flex min-w-0 flex-wrap items-baseline gap-x-1">
          <Link
            href={userHref}
            scroll
            onClick={(event) => event.stopPropagation()}
            className="proposal-author-inline-name max-w-full truncate font-semibold text-[var(--text-black)]"
          >
            {authorLabel}
          </Link>
          {inlineApprovedCollabs.map((collab) => (
            <span key={collab.key} className="inline-flex min-w-0 items-baseline">
              <span className="text-[var(--text-gray-light)]">,</span>
              <Link
                href={`/users/${encodeURIComponent(collab.username)}`}
                scroll
                onClick={(event) => event.stopPropagation()}
                className="proposal-inline-collab-link ml-1 truncate font-semibold"
                title={`Approved collaborator ${collab.username}`}
              >
                {collab.username}
              </Link>
            </span>
          ))}
          {extraApprovedCollabCount > 0 && (
            <span className="proposal-inline-collab-extra ml-1 font-black">
              +{extraApprovedCollabCount}
            </span>
          )}
          <span className="mx-1 text-[var(--text-gray-light)]">{"\u2022"}</span>
          <span className="text-[var(--text-gray-light)]">{time}</span>
        </div>
      </div>
    </div>
  );
}
