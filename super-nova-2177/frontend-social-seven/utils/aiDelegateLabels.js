const GENERIC_DELEGATE_LABELS = new Set([
  "ai delegate",
  "assistant",
  "delegate",
  "generic ai delegate",
  "generic supernova ai delegate",
  "new ai delegate",
  "supernova ai delegate",
  "untitled delegate",
]);

function cleanDelegateText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isGenericDelegateLabel(value) {
  const label = cleanDelegateText(value).toLowerCase();
  return Boolean(label && GENERIC_DELEGATE_LABELS.has(label));
}

export function delegateUsername(delegate = {}) {
  const source = delegate || {};
  return cleanDelegateText(
    source.username ||
      source.ai_actor_username ||
      source.selected_ai_actor_username ||
      source.handle
  ).replace(/^@+/, "");
}

export function delegateKey(delegate = {}) {
  const source = delegate || {};
  const id = source.id;
  if (id !== null && id !== undefined && id !== "") return String(id);
  return delegateUsername(source);
}

export function delegateHandleLabel(delegate = {}) {
  const username = delegateUsername(delegate);
  return username ? `@${username}` : "";
}

export function delegateDisplayLabel(delegate = {}) {
  const source = delegate || {};
  const displayName = cleanDelegateText(
    source.display_name ||
      source.ai_actor_display_name ||
      source.selected_ai_actor_display_name ||
      source.ai_name ||
      source.name
  );
  const handle = delegateHandleLabel(source);
  if (!displayName || isGenericDelegateLabel(displayName)) {
    return handle || displayName || "AI";
  }
  return displayName;
}
