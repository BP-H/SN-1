# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Profile page — clean, no fragile f-strings, works with fake backend."""

import os
import streamlit as st

# --- tiny status helper (never throws) ---
def _status_icon(status="offline") -> str:
    return "🟢" if status == "online" else "🔴"

# --- try fake backend (Option C); otherwise just demo data ---
try:
    from external_services.fake_api import get_profile, save_profile
except Exception:
    def get_profile(username: str):
        return {"username": username, "avatar_url": "", "bio": "", "location": "", "website": ""}
    def save_profile(data: dict):  # noqa: ARG001
        return True

DEFAULT_USER = {
    "username": "guest",
    "avatar_url": "",
    "bio": "Explorer of superNova_2177.",
    "location": "Earth",
    "website": "https://example.com",
    "followers": 2315,
    "following": 1523,
}

def _render_profile_card_ui(profile: dict) -> None:
    st.markdown(f"### @{profile.get('username','guest')}")
    c1, c2 = st.columns([1, 3])
    with c1:
        url = profile.get("avatar_url") or ""
        if url: st.image(url, width=96)
        else:   st.write("🧑‍🚀")
    with c2:
        if profile.get("bio"):      st.write(profile["bio"])
        if profile.get("location"): st.write(f"📍 {profile['location']}")
        if profile.get("website"):  st.write(f"🔗 {profile['website']}")
    m1, m2 = st.columns(2)
    m1.metric("Followers", profile.get("followers", 0))
    m2.metric("Following", profile.get("following", 0))

def main() -> None:
    # Page heading (let ui.py own the big title)
    st.subheader("Profile")

    # Right-aligned status — build string pieces to avoid quote bugs
    status_html = "<div style=\"text-align:right\">" + _status_icon("offline") + " Offline</div>"
    st.markdown(status_html, unsafe_allow_html=True)

    # Username first (so it's defined before any calls)
    username = st.text_input("Username", st.session_state.get("profile_username", "guest"))
    st.session_state["profile_username"] = username

    # Load + merge defaults
    loaded = get_profile(username) or {}
    profile = {**DEFAULT_USER, **loaded, "username": username}

    # Edit block
    with st.expander("Edit", expanded=False):
        profile["avatar_url"] = st.text_input("Avatar URL", profile.get("avatar_url", ""))
        profile["bio"]        = st.text_area("Bio", profile.get("bio", ""))
        profile["location"]   = st.text_input("Location", profile.get("location", ""))
        profile["website"]    = st.text_input("Website", profile.get("website", ""))
        if st.button("Save Profile"):
            st.success("Saved.") if save_profile(profile) else st.error("Save failed.")

    # Render card
    _render_profile_card_ui(profile)

def render() -> None:
    main()

if __name__ == "__main__":
    main()
