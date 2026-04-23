"""Registry of core protocol agents and their purposes."""

from __future__ import annotations

import importlib
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


# Map of agent names to the modules that implement them
_AGENT_SPECS = {
    "CI_PRProtectorAgent": {
        "module": "protocols.agents.ci_pr_protector_agent",
        "class": "CI_PRProtectorAgent",
        "description": "Repairs CI/PR failures by proposing patches.",
        "llm_capable": True,
    },
    "GuardianInterceptorAgent": {
        "module": "protocols.agents.guardian_interceptor_agent",
        "class": "GuardianInterceptorAgent",
        "description": "Inspects LLM suggestions for risky content.",
        "llm_capable": True,
    },
    "MetaValidatorAgent": {
        "module": "protocols.agents.meta_validator_agent",
        "class": "MetaValidatorAgent",
        "description": "Audits patches and adjusts trust scores.",
        "llm_capable": True,
    },
    "ObserverAgent": {
        "module": "protocols.agents.observer_agent",
        "class": "ObserverAgent",
        "description": "Monitors agent outputs and suggests forks when needed.",
        "llm_capable": False,
    },
    "CollaborativePlannerAgent": {
        "module": "protocols.agents.collaborative_planner_agent",
        "class": "CollaborativePlannerAgent",
        "description": "Coordinates tasks and delegates to the best agent.",
        "llm_capable": False,
    },
    "CoordinationSentinelAgent": {
        "module": "protocols.agents.coordination_sentinel_agent",
        "class": "CoordinationSentinelAgent",
        "description": "Detects suspicious validator coordination patterns.",
        "llm_capable": False,
    },
    "HarmonySynthesizerAgent": {
        "module": "protocols.agents.harmony_synthesizer_agent",
        "class": "HarmonySynthesizerAgent",
        "description": "Transforms metrics into short MIDI snippets.",
        "llm_capable": False,
    },
    "TemporalAuditAgent": {
        "module": "protocols.agents.temporal_audit_agent",
        "class": "TemporalAuditAgent",
        "description": "Audits timestamps for suspicious gaps or disorder.",
        "llm_capable": False,
    },
    "CrossUniverseBridgeAgent": {
        "module": "protocols.agents.cross_universe_bridge_agent",
        "class": "CrossUniverseBridgeAgent",
        "description": "Validates cross-universe remix provenance.",
        "llm_capable": True,
    },
    "AnomalySpotterAgent": {
        "module": "protocols.agents.anomaly_spotter_agent",
        "class": "AnomalySpotterAgent",
        "description": "Flags anomalies in metrics streams.",
        "llm_capable": True,
    },
    "QuantumResonanceAgent": {
        "module": "protocols.agents.quantum_resonance_agent",
        "class": "QuantumResonanceAgent",
        "description": "Tracks resonance via quantum simulation.",
        "llm_capable": True,
    },
    "CodexAgent": {
        "module": "protocols.agents.codex_agent",
        "class": "CodexAgent",
        "description": "Base agent with in-memory utilities.",
        "llm_capable": False,
    },
}

# Mapping of agent names to metadata dictionaries
AGENT_REGISTRY: Dict[str, Dict[str, Any]] = {}


def load_registry() -> Dict[str, Dict[str, Any]]:
    """Populate ``AGENT_REGISTRY`` using dynamic imports."""

    if AGENT_REGISTRY:
        return AGENT_REGISTRY

    for name, info in _AGENT_SPECS.items():
        try:
            module = importlib.import_module(info["module"])
            agent_cls = getattr(module, info["class"])
        except Exception as exc:  # pragma: no cover - error path
            logger.error(
                "Failed to load agent %s from %s: %s", name, info["module"], exc
            )
            continue

        AGENT_REGISTRY[name] = {
            "class": agent_cls,
            "description": info["description"],
            "llm_capable": info["llm_capable"],
        }

    return AGENT_REGISTRY


# Initialize registry at import time for backward compatibility
load_registry()

