export const SPECIES_KEYS = ["human", "company", "ai"];
const SPECIES_SHARE_PERCENT = 100 / SPECIES_KEYS.length;

export function normalizeVoteSpecies(value) {
  const species = String(value || "human").trim().toLowerCase();
  if (species === "ai") return "ai";
  if (species === "company" || species === "org" || species === "organization") {
    return "company";
  }
  return "human";
}

export function buildWeightedVoteSummary(likes = [], dislikes = []) {
  const bySpecies = Object.fromEntries(
    SPECIES_KEYS.map((species) => [
      species,
      {
        yes: 0,
        no: 0,
        total: 0,
        /* internalPercent: the species-internal approval rate (0–100%).
         * When 1 human votes "yes" with 0 "no", this is 100%.
         * This is what SpeciesVoteRow should display. */
        internalPercent: 0,
        /* supportPercent: this species's weighted contribution to the
         * overall approval total (0–33.33%).
         * When 1 human votes "yes" and no other species voted, overall
         * supportPercent sums to ~33.33%. */
        supportPercent: 0,
      },
    ])
  );

  likes.forEach((vote) => {
    const species = normalizeVoteSpecies(vote?.type);
    bySpecies[species].yes += 1;
    bySpecies[species].total += 1;
  });

  dislikes.forEach((vote) => {
    const species = normalizeVoteSpecies(vote?.type);
    bySpecies[species].no += 1;
    bySpecies[species].total += 1;
  });

  let supportPercent = 0;

  for (const species of SPECIES_KEYS) {
    const entry = bySpecies[species];
    if (entry.total > 0) {
      entry.internalPercent = (entry.yes / entry.total) * 100;
      entry.supportPercent = (entry.internalPercent / 100) * SPECIES_SHARE_PERCENT;
      supportPercent += entry.supportPercent;
    }
  }

  return {
    supportPercent,
    speciesSharePercent: SPECIES_SHARE_PERCENT,
    bySpecies,
  };
}

function authoritativeBuckets(summary) {
  if (!summary || typeof summary !== "object" || !summary.by_species) return null;
  return Object.fromEntries(
    SPECIES_KEYS.map((species) => {
      const entry = summary.by_species?.[species] || {};
      const yes = Math.max(0, Number(entry.up ?? entry.yes) || 0);
      const no = Math.max(0, Number(entry.down ?? entry.no) || 0);
      return [species, { yes, no }];
    })
  );
}

function rebuildAuthoritativeSummary(summary, buckets) {
  let up = 0;
  let down = 0;
  let weightedSupportPercent = 0;
  const bySpecies = {};

  for (const species of SPECIES_KEYS) {
    const yes = Math.max(0, Number(buckets?.[species]?.yes) || 0);
    const no = Math.max(0, Number(buckets?.[species]?.no) || 0);
    const total = yes + no;
    const internal = total ? (yes / total) * 100 : 0;
    const weighted = (internal / 100) * SPECIES_SHARE_PERCENT;
    up += yes;
    down += no;
    weightedSupportPercent += weighted;
    bySpecies[species] = {
      up: yes,
      down: no,
      total,
      internal_support_percent: Number(internal.toFixed(4)),
      weighted_support_percent: Number(weighted.toFixed(4)),
    };
  }

  const total = up + down;
  return {
    ...(summary || {}),
    schema: summary?.schema || "supernova.three_species_vote.v1",
    up,
    down,
    support: up,
    oppose: down,
    total,
    approval_ratio: total ? Number((up / total).toFixed(4)) : null,
    species_share_percent: Number(SPECIES_SHARE_PERCENT.toFixed(4)),
    weighted_support_percent: Number(weightedSupportPercent.toFixed(4)),
    by_species: bySpecies,
  };
}

export function authoritativeVoteSummaryForDisplay(summary) {
  const buckets = authoritativeBuckets(summary);
  if (!buckets) return null;
  const rebuilt = rebuildAuthoritativeSummary(summary, buckets);
  return {
    authoritative: true,
    supportPercent: rebuilt.weighted_support_percent,
    speciesSharePercent: rebuilt.species_share_percent,
    total: rebuilt.total,
    bySpecies: Object.fromEntries(
      SPECIES_KEYS.map((species) => {
        const entry = rebuilt.by_species[species];
        return [
          species,
          {
            yes: entry.up,
            no: entry.down,
            total: entry.total,
            internalPercent: entry.internal_support_percent,
            supportPercent: entry.weighted_support_percent,
          },
        ];
      })
    ),
  };
}

export function weightedVoteSummary(summary, likes = [], dislikes = []) {
  return authoritativeVoteSummaryForDisplay(summary) || buildWeightedVoteSummary(likes, dislikes);
}

export function adjustAuthoritativeVoteSummary(
  summary,
  { species, previousChoice = null, nextChoice = null } = {}
) {
  const buckets = authoritativeBuckets(summary);
  if (!buckets) return summary || null;
  const normalizedSpecies = normalizeVoteSpecies(species);
  const bucket = buckets[normalizedSpecies];
  if (previousChoice === "up") bucket.yes = Math.max(0, bucket.yes - 1);
  if (previousChoice === "down") bucket.no = Math.max(0, bucket.no - 1);
  if (nextChoice === "up") bucket.yes += 1;
  if (nextChoice === "down") bucket.no += 1;
  return rebuildAuthoritativeSummary(summary, buckets);
}
