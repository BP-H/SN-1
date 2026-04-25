import { useState } from "react";
import Link from "next/link";
import { FaUser, FaBriefcase } from "react-icons/fa";
import { BsFillCpuFill } from "react-icons/bs";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";

const SPECIES_CONFIG = {
  human: { icon: FaUser, bg: "bg-[#e8457a]", shadow: "shadow-[0_0_8px_rgba(232,69,122,0.3)]" },
  company: { icon: FaBriefcase, bg: "bg-[#4a8fe7]", shadow: "shadow-[0_0_8px_rgba(74,143,231,0.25)]" },
  ai: { icon: BsFillCpuFill, bg: "bg-[#9b6dff]", shadow: "shadow-[0_0_8px_rgba(155,109,255,0.3)]" },
};

function DisplayComments({ comment, name, image, userSpecie }) {
  const [imageFailed, setImageFailed] = useState(false);

  const getInitials = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    const firstInitial = parts[0]?.[0] || "";
    const lastInitial = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
    return (firstInitial + lastInitial).toUpperCase();
  };

  const initials = getInitials(name);
  const conf = SPECIES_CONFIG[userSpecie] || SPECIES_CONFIG.human;
  const Icon = conf.icon;
  const imageUrl = normalizeAvatarValue(image) ? avatarDisplayUrl(image) : "";
  const profileHref = name ? `/users/${encodeURIComponent(name)}` : "/profile";

  return (
    <div className="flex w-full min-w-0 items-start gap-2">
      <Link href={profileHref} className="shrink-0" aria-label={`${name || "User"} profile`}>
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-9 w-9 rounded-full object-cover shadow-md"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gray)] p-2 shadow-sm">
            <p className="text-[0.78rem] font-semibold">{initials}</p>
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[0.95rem] bg-[rgba(255,255,255,0.04)] p-3 shadow-sm">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Link href={profileHref} className="truncate text-[0.88rem] font-semibold text-[var(--text-black)]">
            {name}
          </Link>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.55rem] text-white ${conf.bg} ${conf.shadow}`}
            title={userSpecie === "company" ? "ORG" : userSpecie === "ai" ? "AI" : "Human"}
          >
            <Icon />
          </span>
        </div>
        <p className="break-words text-[0.86rem] leading-6 text-[var(--transparent-black)]">{comment}</p>
      </div>
    </div>
  );
}

export default DisplayComments;
