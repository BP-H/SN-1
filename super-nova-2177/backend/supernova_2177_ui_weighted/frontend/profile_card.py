# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""(mobile-first)."""

from __future__ import annotations
import streamlit as st

# ------------------------------------------------------------------  Globals
_CSS_KEY = "_profile_card_css_injected"

_CSS = """
<style id="profile-card-css">
/* ---------- Glassmorphic wrapper ---------- */
.pc-wrapper{
  display:flex;flex-direction:column;align-items:center;
  width:100%;max-width:360px;margin-inline:auto;
  background:var(--card);
  border:1px solid var(--card);
  backdrop-filter:blur(14px) saturate(160%);
  border-radius:1.2rem;overflow:hidden;padding-bottom:1rem;
  animation:fade-in .35s ease forwards;
}
@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1}}

.pc-banner{width:100%;height:84px;
  background:var(--accent);}
.pc-avatar{width:88px;height:88px;border-radius:50%;
  object-fit:cover;background:var(--bg);margin-top:-46px;
  border:4px solid var(--card);}
.pc-name{font-size:1.15rem;font-weight:600;margin:.45rem 0 .1rem}
.pc-tag{font-size:.85rem;color:var(--text-muted,#7e9aaa);
  text-align:center;margin:0 .75rem .65rem}
.pc-stats{display:flex;gap:1.5rem;margin-bottom:.8rem}
.pc-stats .num{font-weight:600;font-size:.95rem;text-align:center}
.pc-stats .lbl{font-size:.75rem;color:var(--text-muted,#7e9aaa);
  text-align:center}
.pc-actions{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center}
.pc-btn{flex:1 1 120px;padding:.45rem .8rem;border:none;
  border-radius:.65rem;background:var(--accent);
  color:var(--bg);font-size:.85rem;cursor:pointer;
  transition:background .2s ease}
.pc-btn:hover{background:var(--accent)}
@media(max-width:400px){.pc-wrapper{max-width:100%}}
</style>
"""

# Default placeholder profile used by pages when no user data is available.
DEFAULT_USER = {
    "username": "JaneDoe",
    "bio": "Dreaming across dimensions and sharing vibes.",
    "followers": 128,
    "following": 75,
    "posts": 34,
    "avatar_url": "https://placehold.co/150x150",
    "website": "https://example.com",
    "location": "Wonderland",
    "feed": [f"https://placehold.co/300x300?text=Post+{i}" for i in range(1, 7)],
}

# ------------------------------------------------------------------  Helpers
def _ensure_css():
    if not st.session_state.get(_CSS_KEY):
        st.markdown(_CSS, unsafe_allow_html=True)
        st.session_state[_CSS_KEY] = True


# ------------------------------------------------------------------  API
def render_profile_card(
    *,
    username: str,
    avatar_url: str,
    tagline: str | None = None,
    stats: dict[str, int] | None = None,
    actions: list[str] | None = None,
) -> None:
    """Render a responsive, LinkedIn-style profile header."""
    _ensure_css()
    stats = stats or {"Followers": 0, "Following": 0}
    actions = actions or []

    st.markdown('<div class="pc-wrapper">', unsafe_allow_html=True)

    # Banner + avatar
    st.markdown('<div class="pc-banner"></div>', unsafe_allow_html=True)
    st.markdown(
        f'<img class="pc-avatar" src="{avatar_url}" alt="avatar">',
        unsafe_allow_html=True,
    )

    # Name & tagline
    st.markdown(f'<div class="pc-name">{username}</div>', unsafe_allow_html=True)
    if tagline:
        st.markdown(f'<div class="pc-tag">{tagline}</div>', unsafe_allow_html=True)

    # Stats
    st.markdown('<div class="pc-stats">', unsafe_allow_html=True)
    for label, value in list(stats.items())[:3]:
        st.markdown(
            f'<div><div class="num">{value}</div>'
            f'<div class="lbl">{label}</div></div>',
            unsafe_allow_html=True,
        )
    st.markdown('</div>', unsafe_allow_html=True)

    # Action buttons
    if actions:
        st.markdown('<div class="pc-actions">', unsafe_allow_html=True)
        btn_cols = st.columns(len(actions), gap="small")
        for col, label in zip(btn_cols, actions):
            with col:
                st.button(label, key=f"{username}_{label}_btn", use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)


__all__ = ["render_profile_card", "DEFAULT_USER"]
