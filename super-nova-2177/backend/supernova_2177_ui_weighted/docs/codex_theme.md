# Codex Dark Theme

The Codex theme provides a minimalist dark appearance inspired by the ChatGPT interface.
It is available through `streamlit_helpers.theme_selector()` and sets the
`Inter` font stack for a clean layout.

### Usage

```python
from streamlit_helpers import theme_selector
from modern_ui import apply_modern_styles

# Apply premium styles and add a radio selector to switch themes
apply_modern_styles()
theme_selector("Theme")
```

To make Codex the default or apply the vibrant cyan palette, update
`.streamlit/config.toml` with the new theme variables:

```toml
[theme]
primaryColor = "#00F0FF"
backgroundColor = "#001E26"
secondaryBackgroundColor = "#002B36"
textColor = "#E0FFFF"
font = "'Inter', sans-serif"
```

### CSS Classes

The `apply_modern_styles()` helper exposes a few utility classes:

| Class | Purpose |
|-------|---------|
| `.gradient-btn` | Applies the gradient button styling with hover animations. |
| `.sidebar-nav .nav-item` | Sidebar navigation element with soft highlights. |
| `.sidebar-nav .icon` | Emoji icon wrapper used inside nav items. |

``SIDEBAR_STYLES`` in ``modern_ui_components`` exposes the sidebar navigation
CSS. Inject it via ``st.markdown(SIDEBAR_STYLES, unsafe_allow_html=True)`` when
building custom sidebars to match the default look.
