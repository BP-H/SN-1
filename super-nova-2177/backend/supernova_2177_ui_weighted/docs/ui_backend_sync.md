<!--
STRICTLY A SOCIAL MEDIA PLATFORM
Intellectual Property & Artistic Inspiration
Legal & Ethical Safeguards
-->

# UI Backend Sync Toggle

The Streamlit UI can connect to either a **mock backend** or the **real backend service**.  
By default, it operates in **mocked mode** to ensure a smooth dev experience.

This toggle allows developers to enable or disable backend integration using either an environment variable or command line flags.

---

## 🔧 Enable Backend with Environment Variable

Set this in your terminal before launching the UI:

```bash
export USE_REAL_BACKEND=1
streamlit run ui.py
