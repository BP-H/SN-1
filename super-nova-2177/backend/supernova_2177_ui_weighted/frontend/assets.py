"""Helper functions returning static CSS and JS snippets for Streamlit pages."""

from __future__ import annotations

__all__ = [
    "story_css",
    "story_js",
    "reaction_css",
    "scroll_js",
]


def story_css() -> str:
    """Return CSS for the horizontal story strip and post cards."""
    return """
<style>
.story-strip{display:flex;overflow-x:auto;gap:0.5rem;padding:0.5rem;margin-bottom:1rem;}
.story-item{flex:0 0 auto;text-align:center;font-size:0.8rem;color:var(--text-muted);}
.story-item img{border-radius:50%;border:2px solid var(--accent);}
.post-card{background:var(--card);padding:0.5rem 0;border-radius:12px;           margin-bottom:1rem;box-shadow:0 1px 2px rgba(0,0,0,0.05);}
.post-header{display:flex;align-items:center;gap:0.5rem;padding:0 0.5rem;margin-bottom:0.5rem;}
.post-header img{border-radius:50%;width:40px;height:40px;}
.post-caption{padding:0.25rem 0.5rem;}
</style>
"""


def story_js() -> str:
    """Return JavaScript for the auto-advancing story carousel."""
    return """
(() => {
  const strip = document.getElementById('story-strip');
  if (!strip || window.storyCarouselInit) return;
  window.storyCarouselInit = true;
  let idx = 0;
  const advance = () => {
    idx = (idx + 1) % strip.children.length;
    const el = strip.children[idx];
    strip.scrollTo({left: el.offsetLeft, behavior: 'smooth'});
  };
  let interval = setInterval(advance, 3000);
  let startX = 0;
  let scrollLeft = 0;
  strip.addEventListener('touchstart', (e) => {
    clearInterval(interval);
    startX = e.touches[0].pageX;
    scrollLeft = strip.scrollLeft;
  });
  strip.addEventListener('touchmove', (e) => {
    const x = e.touches[0].pageX;
    const walk = startX - x;
    strip.scrollLeft = scrollLeft + walk;
  });
  strip.addEventListener('touchend', () => {
    interval = setInterval(advance, 3000);
  });
})();
"""


def reaction_css() -> str:
    """Return CSS and external font link for reaction buttons."""
    return """
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
.reaction-btn{background:transparent;border:none;font-size:1.1rem;cursor:pointer;margin-right:0.25rem;transition:transform 0.1s ease;}
.reaction-btn:active{transform:scale(1.2);}
</style>
"""


def scroll_js() -> str:
    """Return JavaScript for observing the feed load sentinel."""
    return """
<script>
const sentinel = document.getElementById('load-sentinel');
if(sentinel){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{if(e.isIntersecting){const btn=document.getElementById('load-more-btn');btn&&btn.click();}});
  });
  observer.observe(sentinel);
}
</script>
"""

