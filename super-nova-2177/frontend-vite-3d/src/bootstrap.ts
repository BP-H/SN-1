// src/bootstrap.ts
// Logs runtime errors early and shows a simple fallback message.
function showFallback() {
  if (document.getElementById('bootstrap-error')) return;
  const el = document.createElement('p');
  el.id = 'bootstrap-error';
  el.textContent = 'An unexpected error occurred while loading the app.';
  el.style.cssText =
    'position:fixed;inset:16px;z-index:99999;padding:12px;border-radius:8px;' +
    'background:rgba(0,0,0,0.85);color:#fff;font:14px/1.4 sans-serif;';
  const append = () => {
    if (document.body) {
      document.body.appendChild(el);
    }
  };
  if (document.body) append();
  else document.addEventListener('DOMContentLoaded', append);
}

window.onerror = function (_message, _source, _lineno, _colno, error) {
  console.error('Uncaught error:', error);
  showFallback();
};

window.onunhandledrejection = function (event) {
  console.error('Unhandled promise rejection:', event.reason);
  showFallback();
};
