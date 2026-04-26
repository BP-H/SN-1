const SPECIES_COLORS = {
  human: "#e8457a",
  company: "#4a8fe7",
  ai: "#9b6dff",
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
    borderWidth: strong ? "4px" : "3px",
    boxShadow: `0 0 0 1px ${hexToRgba(color, 0.2)}, 0 0 ${strong ? 22 : 16}px ${hexToRgba(
      color,
      strong ? 0.38 : 0.24
    )}`,
  };
}
