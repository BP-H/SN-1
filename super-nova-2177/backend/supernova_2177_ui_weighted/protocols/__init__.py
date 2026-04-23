# protocols/__init__.py

from ._registry import AGENT_REGISTRY, load_registry  # noqa: F401
from .core.contracts import AgentTaskContract  # noqa: F401
from .core.profiles import AgentProfile  # noqa: F401
from .profiles.dream_weaver import DreamWeaver  # noqa: F401
from .profiles.validator_elf import ValidatorElf  # noqa: F401
from .utils.forking import fork_agent  # noqa: F401
from .utils.reflection import self_reflect  # noqa: F401
from .utils.remote import handshake, ping_agent  # noqa: F401

# Ensure the registry is populated before exposing agent classes
load_registry()

# Expose agent classes for convenience
_loaded_agents = []
for _name, _info in AGENT_REGISTRY.items():
    try:
        globals()[_name] = _info["class"]
    except Exception:
        continue
    else:
        _loaded_agents.append(_name)

__all__ = (
    "AgentProfile",
    "AgentTaskContract",
    "self_reflect",
    "ping_agent",
    "handshake",
    "fork_agent",
    "ValidatorElf",
    "DreamWeaver",
) + tuple(_loaded_agents) + ("AGENT_REGISTRY",)

