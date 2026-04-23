const SPECIES_KEYS = ["human", "company", "ai"];
const SPECIES_SHARE_PERCENT = 100 / SPECIES_KEYS.length;

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
    const species = SPECIES_KEYS.includes(vote?.type) ? vote.type : "human";
    bySpecies[species].yes += 1;
    bySpecies[species].total += 1;
  });

  dislikes.forEach((vote) => {
    const species = SPECIES_KEYS.includes(vote?.type) ? vote.type : "human";
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
