from typing import Any, Dict, Iterable, Tuple


SPECIES_KEYS = ("human", "ai", "company")
SPECIES_SHARE_PERCENT = 100.0 / len(SPECIES_KEYS)


def normalize_vote_species(value: Any) -> str:
    species = str(value or "human").strip().lower()
    if species == "ai":
        return "ai"
    if species in {"company", "org", "organization"}:
        return "company"
    return "human"


def build_three_species_vote_summary(
    grouped_counts: Iterable[Tuple[Any, Any, Any]] = (),
) -> Dict[str, Any]:
    by_species = {
        species: {
            "up": 0,
            "down": 0,
            "total": 0,
            "internal_support_percent": 0.0,
            "weighted_support_percent": 0.0,
        }
        for species in SPECIES_KEYS
    }

    for choice_value, species_value, count_value in grouped_counts:
        choice = str(choice_value or "").strip().lower()
        if choice not in {"up", "down"}:
            continue
        species = normalize_vote_species(species_value)
        try:
            count = max(0, int(count_value or 0))
        except (TypeError, ValueError):
            count = 0
        by_species[species][choice] += count

    up = 0
    down = 0
    weighted_support_percent = 0.0
    for species in SPECIES_KEYS:
        entry = by_species[species]
        entry["total"] = entry["up"] + entry["down"]
        up += entry["up"]
        down += entry["down"]
        if entry["total"]:
            internal = entry["up"] / entry["total"] * 100.0
            weighted = internal / 100.0 * SPECIES_SHARE_PERCENT
            entry["internal_support_percent"] = round(internal, 4)
            entry["weighted_support_percent"] = round(weighted, 4)
            weighted_support_percent += weighted

    total = up + down
    return {
        "schema": "supernova.three_species_vote_summary.v1",
        "up": up,
        "down": down,
        "support": up,
        "oppose": down,
        "total": total,
        "approval_ratio": round(up / total, 4) if total else None,
        "species_share_percent": round(SPECIES_SHARE_PERCENT, 4),
        "weighted_support_percent": round(weighted_support_percent, 4),
        "by_species": by_species,
    }
