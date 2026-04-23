# Extending the Streamlit UI

The project exposes two Streamlit frontends:

- `app.py` loads the thin wrappers in the top-level `pages/` directory and can be launched with:

  ```bash
  streamlit run app.py
  ```

- `transcendental_resonance_frontend/ui.py` (or `python -m transcendental_resonance_frontend`) pulls in the full pages from `transcendental_resonance_frontend/pages/`:

  ```bash
  python transcendental_resonance_frontend/ui.py
  # or
  python -m transcendental_resonance_frontend
  ```

`streamlit_helpers.py` exposes small utilities used by `ui.py` for common tasks.
Import these helpers in your own modules to keep layouts consistent. Header
labels can include emoji characters and are sanitized automatically to prevent
HTML injection.

```python
import streamlit as st
from streamlit_helpers import header, theme_selector, centered_container
from modern_ui import apply_modern_styles

apply_modern_styles()
header("Custom Page", layout="wide")
with centered_container():
    theme_selector("Theme")
    st.write("Hello World")
```

Running this example will render a page with the standard header, a theme switcher
radio button and a centered content area.

The theme selector stores the chosen light or dark mode in `st.session_state` and
persists the value in the browser query string. Reloading the page keeps your
selection intact.

`render_top_bar()` now includes a **Beta Mode** toggle. When enabled, the flag is
saved to `st.session_state['beta_mode']` and experimental features become
available. For example, the VibeNodes page shows an **AI Remix** button on each
post that calls `/vibenodes/{id}/remix` and displays the generated remix in a
modal dialog.

The Streamlit app also supports a lightweight health check for CI or uptime
monitors. Visiting `/?healthz=1` responds with `ok` and stops execution. This
serves as a simple fallback when the built-in `/healthz` route isn't available,
so monitoring systems can confirm the UI started successfully.
