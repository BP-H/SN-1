import { FaUser, FaBriefcase } from "react-icons/fa";
import { BsFillCpuFill } from "react-icons/bs";

const SPECIES_CONFIG = {
  human: { icon: FaUser, bg: "bg-[#e8457a]", shadow: "shadow-[0_0_8px_rgba(232,69,122,0.3)]" },
  company: { icon: FaBriefcase, bg: "bg-[#4a8fe7]", shadow: "shadow-[0_0_8px_rgba(74,143,231,0.25)]" },
  ai: { icon: BsFillCpuFill, bg: "bg-[#9b6dff]", shadow: "shadow-[0_0_8px_rgba(155,109,255,0.3)]" },
};

function DisplayComments({ comment, name, image, userSpecie }) {
  const getInitials = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    const firstInitial = parts[0]?.[0] || "";
    const lastInitial = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
    return (firstInitial + lastInitial).toUpperCase();
  };

  const isValidImage = (url) => {
    if (!url) return false;
    return /\.(jpeg|jpg|png|webp|gif)$/i.test(url.trim());
  };

  const initials = getInitials(name);
  const conf = SPECIES_CONFIG[userSpecie] || SPECIES_CONFIG.human;
  const Icon = conf.icon;

  return (
    <div className="flex w-full min-w-0 items-start gap-2">
      {isValidImage(image) ? (
        <img
          src={image}
          alt={name}
          className="h-10 w-10 shrink-0 rounded-full object-cover shadow-md"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/default-avatar.png";
          }}
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gray)] p-2 shadow-sm">
          <p className="text-[0.78rem] font-semibold">{initials}</p>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[1rem] bg-[var(--gray)] p-3 shadow-sm">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-[0.88rem] font-semibold text-[var(--text-black)]">{name}</p>
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
