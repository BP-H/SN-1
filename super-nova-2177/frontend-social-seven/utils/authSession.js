export const PASSWORD_SESSION_KEY = "supernova_password_session";

export function readPasswordAuthSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PASSWORD_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function authHeaders(headers = {}) {
  const token = readPasswordAuthSession()?.token;
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
