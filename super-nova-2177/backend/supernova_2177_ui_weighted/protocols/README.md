# Protocols Package

This package contains modular agents and supporting utilities used for automated code validation workflows.

## Agents
- **CI_PRProtectorAgent** – repairs CI/PR failures by proposing patches.
- **GuardianInterceptorAgent** – inspects LLM suggestions for risky content.
- **MetaValidatorAgent** – audits patches and adjusts trust scores.
- **ObserverAgent** – monitors agent outputs and suggests forks when needed.
- **CollaborativePlannerAgent** – delegates tasks to the best-suited agent.

Utilities, core interfaces, and prebuilt profiles are organized under corresponding subfolders for easy extension.

```python
from protocols import GuardianInterceptorAgent, CI_PRProtectorAgent
```

See `protocols/_registry.py` for a programmatic listing of available agents.

### UI hooks
Additional FastAPI-based UI integrations live in modules such as
`protocols/ui_hook.py` and `protocols/agents/*_ui_hook.py`. These are not
imported automatically with the core package. Running the optional UI requires
installing the project's `ui` extras defined in `requirements.txt`.
