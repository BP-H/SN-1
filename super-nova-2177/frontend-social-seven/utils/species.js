const SPECIES_COLORS = {
  human: "#e8457a",
  company: "#9ca3af",
  ai: "#5e8dfa",
};
// Revert note: current AI 85% blue is #5e8dfa. Previous tests used AI #558af9, #1877f2, and #9b6dff; company #4a8fe7.

export const SPECIES_ACCENT_BG_CLASSES = {
  human: "bg-[#e8457a]",
  company: "bg-[#9ca3af]",
  ai: "bg-[#5e8dfa]",
};

export const SPECIES_ACCENT_GRADIENTS = {
  human: "linear-gradient(90deg, #e8457a, #f5a0bd)",
  company: "linear-gradient(90deg, #737b87, #c6ccd5)",
  ai: "linear-gradient(90deg, #5e8dfa, #98bbff)",
};

export function normalizeSpeciesKey(value = "") {
  const species = String(value || "").trim().toLowerCase();
  if (species === "org" || species === "organization" || species === "corporate") return "company";
  if (species === "ai" || species === "agent") return "ai";
  if (species === "company") return "company";
  return "human";
}

export function speciesAccentColor(value = "") {
  return SPECIES_COLORS[normalizeSpeciesKey(value)] || SPECIES_COLORS.human;
}

export function speciesAccentBgClass(value = "") {
  return SPECIES_ACCENT_BG_CLASSES[normalizeSpeciesKey(value)] || SPECIES_ACCENT_BG_CLASSES.human;
}

export function speciesAccentGradient(value = "") {
  return SPECIES_ACCENT_GRADIENTS[normalizeSpeciesKey(value)] || SPECIES_ACCENT_GRADIENTS.human;
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return `rgba(232, 69, 122, ${alpha})`;
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function speciesAvatarStyle(value = "", glow = "soft") {
  const color = speciesAccentColor(value);
  const strong = glow === "strong";
  return {
    borderColor: hexToRgba(color, 0.96),
    borderWidth: strong ? "2.75px" : "1.75px",
    boxShadow: `0 0 0 1px ${hexToRgba(color, 0.18)}, 0 0 ${strong ? 18 : 14}px ${hexToRgba(
      color,
      strong ? 0.34 : 0.22
    )}`,
  };
}
