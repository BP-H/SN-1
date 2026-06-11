"use client";

import { useEffect, useMemo, useState } from "react";
import { BsFillCpuFill } from "react-icons/bs";
import { FaBriefcase, FaUser } from "react-icons/fa";
import LiquidGlass from "@/content/liquid glass/LiquidGlass";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL } from "@/utils/apiBase";
import { speciesAccentGradient } from "@/utils/species";
import { buildWeightedVoteSummary } from "@/utils/voteWeights";

const SLIDER_BLUE = "#5e8dfa";
const SPECIES_OPTIONS = [
  { key: "all", label: "All", shortLabel: "All", icon: null },
  { key: "human", label: "Humans", shortLabel: "Human", icon: FaUser },
  { key: "company", label: "ORG", shortLabel: "ORG", icon: FaBriefcase },
  { key: "ai", label: "AI", shortLabel: "AI", icon: BsFillCpuFill },
];
const CHOICE_OPTIONS = [
  { key: "all", label: "All votes" },
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
];

function normalizeSpecies(value) {
  const species = String(value || "human").toLowerCase();
  if (species === "ai") return "ai";
  if (species === "company" || species === "org" || species === "organization") return "company";
  return "human";
}

function voterName(vote = {}) {
  return String(vote.voter || vote.username || vote.name || "Unknown voter").trim();
}

function voterInitials(name) {
  const clean = String(name || "SN").replace(/^@+/, "").trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "SN";
}

/* Old weighted-slider blue start: hsl(230,80%,75%). */
function getSliderColor(ratio) {
  const pinkShare = Math.round(Math.min(Math.max(ratio, 0), 100));
  return `color-mix(in srgb, ${SLIDER_BLUE} ${100 - pinkShare}%, var(--pink) ${pinkShare}%)`;
}

function SpeciesVoteRow({
  icon: Icon,
  label,
  likes,
  dislikes,
  internalPercent,
  accent,
  speciesKey,
  activeSpecies,
  activeChoice,
  onFilter,
}) {
  const ratio = Math.round(internalPercent || 0);
  const hasVotes = likes + dislikes > 0;
  const isActiveSpecies = activeSpecies === speciesKey;

  return (
    <div className={`vote-info-row grid w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-[1rem] px-3 py-2.5 ${isActiveSpecies ? "vote-info-row-active" : ""}`}>
      <span className="vote-info-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <Icon />
      </span>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.78rem] font-semibold text-[var(--text-black)]">{label}</span>
          <span className="text-right text-[0.72rem] text-[var(--text-gray-light)]">
            {hasVotes ? `${ratio}% support` : "No votes yet"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={`vote-info-count-button ${activeSpecies === speciesKey && activeChoice === "yes" ? "vote-info-count-button-active" : ""}`}
            onClick={() => onFilter(speciesKey, "yes")}
            disabled={!likes}
          >
            <span>Yes</span>
            <strong>{likes}</strong>
          </button>
          <button
            type="button"
            className={`vote-info-count-button ${activeSpecies === speciesKey && activeChoice === "no" ? "vote-info-count-button-active" : ""}`}
            onClick={() => onFilter(speciesKey, "no")}
            disabled={!dislikes}
          >
            <span>No</span>
            <strong>{dislikes}</strong>
          </button>
        </div>
      </div>
      <div className="vote-info-track col-start-2 h-1.5 rounded-full">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${internalPercent || 0}%`,
            background: accent,
          }}
        />
      </div>
    </div>
  );
}

function LikesInfo({ proposalId, likesData, dislikesData, className = "" }) {
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [error, setError] = useState("");
  const [activeSpecies, setActiveSpecies] = useState("all");
  const [activeChoice, setActiveChoice] = useState("all");
  const { userData } = useUser();
  const backendUrl = userData?.activeBackend || API_BASE_URL;

  useEffect(() => {
    if (likesData || dislikesData) {
      setLikes(likesData || []);
      setDislikes(dislikesData || []);
      setError("");
      return;
    }

    async function fetchVotes() {
      if (!backendUrl) {
        setError("API base URL is not configured.");
        return;
      }

      try {
        setError("");
        const response = await fetch(`${backendUrl}/proposals/${proposalId}`);
        if (!response.ok) {
          setError(`Failed to load proposal: ${response.status} ${response.statusText}`);
          return;
        }

        const data = await response.json();
        setLikes(data.likes || []);
        setDislikes(data.dislikes || []);
      } catch (err) {
        setError(`Failed to fetch vote details: ${err.message}`);
      }
    }

    fetchVotes();
  }, [backendUrl, proposalId, likesData, dislikesData]);

  const counts = useMemo(() => buildWeightedVoteSummary(likes, dislikes), [likes, dislikes]);
  const voters = useMemo(() => {
    const yesVotes = likes.map((vote) => ({
      ...vote,
      choice: "yes",
      species: normalizeSpecies(vote?.type),
      name: voterName(vote),
    }));
    const noVotes = dislikes.map((vote) => ({
      ...vote,
      choice: "no",
      species: normalizeSpecies(vote?.type),
      name: voterName(vote),
    }));
    return [...yesVotes, ...noVotes];
  }, [likes, dislikes]);
  const filteredVoters = useMemo(() => {
    return voters.filter((vote) => {
      const speciesMatches = activeSpecies === "all" || vote.species === activeSpecies;
      const choiceMatches = activeChoice === "all" || vote.choice === activeChoice;
      return speciesMatches && choiceMatches;
    });
  }, [activeChoice, activeSpecies, voters]);
  const activeSpeciesLabel =
    SPECIES_OPTIONS.find((option) => option.key === activeSpecies)?.shortLabel || "All";
  const activeChoiceLabel =
    CHOICE_OPTIONS.find((option) => option.key === activeChoice)?.label || "All votes";

  const totalVotes = likes.length + dislikes.length;
  const overallApproval = Math.round(counts.supportPercent || 0);
  const setFilter = (species, choice = activeChoice) => {
    setActiveSpecies(species);
    setActiveChoice(choice);
  };

  return (
    <LiquidGlass className={`vote-info-glass w-full rounded-[1.2rem] p-3 ${className}`.trim()}>
      <div className="vote-info-content flex w-full flex-col gap-2.5">
        {error ? (
          <p className="text-[0.76rem] text-red-400">{error}</p>
        ) : (
          <>
            {/* Overall weighted approval header */}
            <div className="vote-info-header flex items-center justify-between rounded-[0.8rem] px-3 py-2">
              <span className="text-[0.76rem] font-semibold text-[var(--text-black)]">
                Weighted Approval
              </span>
              <span className="text-[0.82rem] font-bold" style={{ color: getSliderColor(overallApproval) }}>
                {overallApproval}%
              </span>
            </div>
            <div className="vote-info-track mx-3 mb-1 h-1 rounded-full">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(counts.supportPercent, 100)}%`,
                  background: `linear-gradient(90deg, ${SLIDER_BLUE} 0%, ${getSliderColor(counts.supportPercent)} 100%)`,
                }}
              />
            </div>
            <p className="mb-1 text-center text-[0.66rem] text-[var(--text-gray-light)]">
              {totalVotes} total vote{totalVotes !== 1 ? "s" : ""} - Each species carries 33% weight
            </p>

            <div className="vote-info-filter-grid" aria-label="Filter votes by species">
              {SPECIES_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = activeSpecies === option.key;
                return (
                  <button
                    type="button"
                    key={option.key}
                    className={`vote-info-filter-chip ${isActive ? "vote-info-filter-chip-active" : ""}`}
                    onClick={() => setFilter(option.key, activeChoice)}
                    aria-pressed={isActive}
                  >
                    {Icon && <Icon />}
                    <span>{option.shortLabel}</span>
                  </button>
                );
              })}
            </div>
            <div className="vote-info-choice-grid" aria-label="Filter votes by answer">
              {CHOICE_OPTIONS.map((option) => {
                const isActive = activeChoice === option.key;
                return (
                  <button
                    type="button"
                    key={option.key}
                    className={`vote-info-choice-chip ${isActive ? "vote-info-choice-chip-active" : ""}`}
                    onClick={() => setActiveChoice(option.key)}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <SpeciesVoteRow
              icon={FaUser}
              label="Humans"
              likes={counts.bySpecies.human.yes}
              dislikes={counts.bySpecies.human.no}
              internalPercent={counts.bySpecies.human.internalPercent}
              accent={speciesAccentGradient("human")}
              speciesKey="human"
              activeSpecies={activeSpecies}
              activeChoice={activeChoice}
              onFilter={setFilter}
            />
            <SpeciesVoteRow
              icon={FaBriefcase}
              label="ORG"
              likes={counts.bySpecies.company.yes}
              dislikes={counts.bySpecies.company.no}
              internalPercent={counts.bySpecies.company.internalPercent}
              accent={speciesAccentGradient("company")}
              speciesKey="company"
              activeSpecies={activeSpecies}
              activeChoice={activeChoice}
              onFilter={setFilter}
            />
            <SpeciesVoteRow
              icon={BsFillCpuFill}
              label="AI"
              likes={counts.bySpecies.ai.yes}
              dislikes={counts.bySpecies.ai.no}
              internalPercent={counts.bySpecies.ai.internalPercent}
              accent={speciesAccentGradient("ai")}
              speciesKey="ai"
              activeSpecies={activeSpecies}
              activeChoice={activeChoice}
              onFilter={setFilter}
            />

            <section className="vote-info-voter-panel" aria-live="polite">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[var(--pink)]">
                    Voters
                  </p>
                  <p className="text-[0.72rem] text-[var(--text-gray-light)]">
                    {activeSpeciesLabel} - {activeChoiceLabel}
                  </p>
                </div>
                <span className="vote-info-voter-count">{filteredVoters.length}</span>
              </div>
              {filteredVoters.length > 0 ? (
                <div className="vote-info-voter-list">
                  {filteredVoters.map((vote, index) => {
                    const speciesOption = SPECIES_OPTIONS.find((option) => option.key === vote.species);
                    const Icon = speciesOption?.icon || FaUser;
                    return (
                      <div className="vote-info-voter-row" key={`${vote.choice}-${vote.species}-${vote.name}-${index}`}>
                        <span className={`vote-info-voter-avatar vote-info-voter-avatar-${vote.species}`}>
                          {voterInitials(vote.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.78rem] font-semibold text-[var(--text-black)]">
                            {vote.name.startsWith("@") ? vote.name : `@${vote.name}`}
                          </span>
                          <span className="flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-gray-light)]">
                            <Icon />
                            {speciesOption?.shortLabel || "Human"}
                          </span>
                        </span>
                        <span className={`vote-info-choice-badge vote-info-choice-badge-${vote.choice}`}>
                          {vote.choice}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="vote-info-empty">
                  No voters match this view yet.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </LiquidGlass>
  );
}

export default LikesInfo;
