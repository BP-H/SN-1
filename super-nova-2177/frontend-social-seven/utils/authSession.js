export const PASSWORD_SESSION_KEY = "supernova_password_session";
export const BACKEND_AUTH_MISSING_MESSAGE = "Finish account setup / sign in again.";

function readStoredJson(storage, key) {
  if (typeof window === "undefined" || !storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredJson(storage, key, value) {
  if (typeof window === "undefined" || !storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore unavailable storage.
  }
}

function removeStoredJson(storage, key) {
  if (typeof window === "undefined" || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

export function normalizeBackendAuthSession(payload = {}) {
  const token = String(payload.token || payload.access_token || "").trim();
  if (!token) return null;
  const user = payload.user || {};
  return {
    token,
    id: payload.id || user.id || payload.username || user.username || "",
    username: payload.username || user.username || "",
    email: payload.email || user.email || "",
    avatar: payload.avatar || payload.avatar_url || user.avatar_url || user.profile_pic || "",
    species: payload.species || user.species || "human",
  };
}

export function readPasswordAuthSession() {
  if (typeof window === "undefined") return null;
  const sessionAuth = readStoredJson(window.sessionStorage, PASSWORD_SESSION_KEY);
  if (sessionAuth?.token) return sessionAuth;

  const legacyAuth = readStoredJson(window.localStorage, PASSWORD_SESSION_KEY);
  if (legacyAuth?.token) {
    writeStoredJson(window.sessionStorage, PASSWORD_SESSION_KEY, legacyAuth);
    removeStoredJson(window.localStorage, PASSWORD_SESSION_KEY);
    return legacyAuth;
  }
  return null;
}

export function writeBackendAuthSession(payload) {
  if (typeof window === "undefined") return null;
  const authPayload = normalizeBackendAuthSession(payload);
  if (!authPayload?.token) return null;
  writeStoredJson(window.sessionStorage, PASSWORD_SESSION_KEY, authPayload);
  removeStoredJson(window.localStorage, PASSWORD_SESSION_KEY);
  return authPayload;
}

export function clearBackendAuthSession() {
  if (typeof window === "undefined") return;
  removeStoredJson(window.sessionStorage, PASSWORD_SESSION_KEY);
  removeStoredJson(window.localStorage, PASSWORD_SESSION_KEY);
}

export function hasBackendAuthSession() {
  return Boolean(readPasswordAuthSession()?.token);
}

export function requireBackendAuthSession() {
  const session = readPasswordAuthSession();
  if (!session?.token) {
    throw new Error(BACKEND_AUTH_MISSING_MESSAGE);
  }
  return session;
}

export function authHeaders(headers = {}) {
  const token = readPasswordAuthSession()?.token;
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
