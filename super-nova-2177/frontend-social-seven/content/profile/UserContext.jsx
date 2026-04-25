"use client";

import { createContext, useState, useContext, useEffect, useCallback, useMemo } from "react";
import supabase, { isSupabaseConfigured } from "@/supabaseClient";
import { API_BASE_URL } from "@/utils/apiBase";
import { FALLBACK_AVATAR, normalizeAvatarValue } from "@/utils/avatar";

const UserContext = createContext();

const GUEST_STORAGE_KEY = "supernova_social_six_guest";
const CUSTOM_STORAGE_PREFIX = "supernova_social_six_custom::";
const PASSWORD_SESSION_KEY = "supernova_password_session";
const DEFAULT_AVATAR = FALLBACK_AVATAR;

function calculateInitials(name) {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts.map((part) => part[0].toUpperCase()).join("").slice(0, 2);
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function readStorage(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore unavailable storage.
  }
}

function removeStorage(key) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

function getCustomStorageKey(authUser, passwordAuth) {
  const identityId = authUser?.id || passwordAuth?.id;
  if (!identityId) return GUEST_STORAGE_KEY;
  return `${CUSTOM_STORAGE_PREFIX}${identityId}`;
}

function getProviderProfile(authUser) {
  if (!authUser) {
    return {
      id: null,
      email: "",
      name: "",
      avatar: "",
      provider: "guest",
    };
  }

  const metadata = authUser.user_metadata || {};
  const provider = authUser.app_metadata?.provider
    || metadata.provider
    || authUser.identities?.[0]?.provider
    || "oauth";

  return {
    id: authUser.id,
    email: authUser.email || metadata.email || "",
    name: metadata.full_name || metadata.name || authUser.email || "",
    avatar: normalizeAvatarValue(metadata.avatar_url || metadata.picture || ""),
    provider,
  };
}

function getPasswordProfile(passwordAuth) {
  if (!passwordAuth) return null;
  return {
    id: passwordAuth.id || passwordAuth.username || null,
    email: passwordAuth.email || "",
    name: passwordAuth.username || "",
    avatar: normalizeAvatarValue(passwordAuth.avatar || ""),
    provider: "password",
  };
}

function mergeUserData(providerProfile, storedProfile = {}) {
  if (!providerProfile.id) {
    const species = storedProfile.species || "human";
    return {
      id: null,
      email: "",
      provider: "guest",
      isAuthenticated: false,
      species,
      avatar: "",
      providerAvatar: "",
      name: "",
      providerName: "",
      initials: "SN",
    };
  }

  const effectiveName = storedProfile.customName || providerProfile.name || "";
  const storedAvatar = normalizeAvatarValue(storedProfile.customAvatar || "");
  const providerAvatar = normalizeAvatarValue(providerProfile.avatar || "");
  const effectiveAvatar = storedAvatar || providerAvatar || "";
  const species = storedProfile.species || "human";

  return {
    id: providerProfile.id,
    email: providerProfile.email || "",
    provider: providerProfile.provider || "guest",
    isAuthenticated: Boolean(providerProfile.id),
    species,
    avatar: effectiveAvatar,
    providerAvatar,
    name: effectiveName,
    providerName: providerProfile.name || "",
    initials: calculateInitials(effectiveName || providerProfile.email || ""),
  };
}

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [passwordAuth, setPasswordAuth] = useState(null);
  const [storedProfile, setStoredProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const authUser = session?.user ?? null;
  const providerProfile = useMemo(
    () => getPasswordProfile(!authUser ? passwordAuth : null) || getProviderProfile(authUser),
    [authUser, passwordAuth]
  );

  useEffect(() => {
    const savedPasswordAuth = readStorage(PASSWORD_SESSION_KEY);
    const initialStored = readStorage(getCustomStorageKey(null, savedPasswordAuth)) || readStorage(GUEST_STORAGE_KEY) || {};
    if (savedPasswordAuth?.token) setPasswordAuth(savedPasswordAuth);
    setStoredProfile(initialStored);

    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextSession = data?.session ?? null;
      setSession(nextSession);
      if (nextSession?.user) setPasswordAuth(null);
      const key = getCustomStorageKey(nextSession?.user ?? null, nextSession?.user ? null : savedPasswordAuth);
      setStoredProfile(readStorage(key) || {});
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      if (nextSession?.user) setPasswordAuth(null);
      const key = getCustomStorageKey(nextSession?.user ?? null, nextSession?.user ? null : savedPasswordAuth);
      setStoredProfile(readStorage(key) || {});
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const userData = useMemo(
    () => mergeUserData(providerProfile, storedProfile || {}),
    [providerProfile, storedProfile]
  );

  useEffect(() => {
    if (!providerProfile.id || providerProfile.provider === "guest") return undefined;

    let cancelled = false;
    const username =
      userData.name ||
      providerProfile.name ||
      providerProfile.email?.split("@")[0] ||
      `${providerProfile.provider}-${providerProfile.id.slice(0, 8)}`;

    fetch(`${API_BASE_URL}/auth/social/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerProfile.provider,
        provider_id: providerProfile.id,
        email: providerProfile.email,
        username,
        avatar_url: normalizeAvatarValue(userData.avatar || providerProfile.avatar || ""),
        species: userData.species || "human",
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.username) return;
      })
      .catch(() => {
        // Social auth remains usable even if the local backend is offline.
      });

    return () => {
      cancelled = true;
    };
  }, [
    providerProfile.avatar,
    providerProfile.email,
    providerProfile.id,
    providerProfile.name,
    providerProfile.provider,
    userData.avatar,
    userData.name,
    userData.species,
  ]);

  const persistProfile = useCallback((nextStored) => {
    const key = getCustomStorageKey(authUser, passwordAuth);
    writeStorage(key, nextStored);
    setStoredProfile(nextStored);
  }, [authUser, passwordAuth]);

  const setUserData = useCallback((update) => {
    const previous = storedProfile || {};
    const current = mergeUserData(providerProfile, previous);
    const patch = typeof update === "function" ? update(current) : update;
    const nextStored = {
      species: patch?.species || current.species || "human",
      customName: typeof patch?.name === "string" ? patch.name : previous.customName || current.name || "",
      customAvatar: typeof patch?.avatar === "string"
        ? normalizeAvatarValue(patch.avatar)
        : normalizeAvatarValue(previous.customAvatar || current.avatar || ""),
    };
    const key = getCustomStorageKey(authUser, passwordAuth);
    writeStorage(key, nextStored);
    setStoredProfile(nextStored);

    const username = passwordAuth?.username || nextStored.customName || current.name || providerProfile.name || "";
    const shouldSyncProfile =
      Boolean(passwordAuth?.token) || Boolean(providerProfile.id && providerProfile.provider !== "guest");
    if (username && shouldSyncProfile) {
      fetch(`${API_BASE_URL}/profile/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_url: normalizeAvatarValue(nextStored.customAvatar || ""),
          species: nextStored.species || "human",
        }),
      }).catch(() => {
        // Local profile stays usable if backend sync is temporarily unavailable.
      });
    }

    if (passwordAuth?.token) {
      setPasswordAuth((prev) => {
        if (!prev) return prev;
        const nextAuth = {
          ...prev,
          avatar: normalizeAvatarValue(nextStored.customAvatar || ""),
          species: nextStored.species || "human",
        };
        writeStorage(PASSWORD_SESSION_KEY, nextAuth);
        return nextAuth;
      });
    }
  }, [authUser, passwordAuth, providerProfile, storedProfile]);

  const resetCustomProfile = useCallback(() => {
    const key = getCustomStorageKey(authUser, passwordAuth);
    removeStorage(key);
    setStoredProfile({});
  }, [authUser, passwordAuth]);

  const applyPasswordSession = useCallback((payload) => {
    const authPayload = {
      token: payload.access_token,
      id: payload.user?.id || payload.user?.username,
      username: payload.user?.username || "",
      email: payload.user?.email || "",
      avatar: normalizeAvatarValue(payload.user?.avatar_url || payload.user?.profile_pic || ""),
      species: payload.user?.species || "human",
    };
    writeStorage(PASSWORD_SESSION_KEY, authPayload);
    setSession(null);
    setPasswordAuth(authPayload);
    const key = getCustomStorageKey(null, authPayload);
    const savedProfile = readStorage(key) || {};
    const savedAvatar = normalizeAvatarValue(savedProfile.customAvatar || "");
    setStoredProfile({
      species: savedProfile.species || authPayload.species,
      customName: savedProfile.customName || authPayload.username,
      customAvatar: normalizeAvatarValue(authPayload.avatar || savedAvatar),
    });
    return authPayload;
  }, []);

  const loginWithPassword = useCallback(async ({ username, password }) => {
    let response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    let payload = await response.json().catch(() => ({}));

    if (response.status === 404) {
      const formData = new URLSearchParams();
      formData.set("username", username);
      formData.set("password", password);
      response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      payload = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      throw new Error(payload?.detail || "Unable to sign in.");
    }
    return applyPasswordSession(payload);
  }, [applyPasswordSession]);

  const registerWithPassword = useCallback(async ({ username, password, email, species }) => {
    const response = await fetch(`${API_BASE_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email, species }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || "Unable to create account.");
    }
    return loginWithPassword({ username, password });
  }, [loginWithPassword]);

  const loginWithProvider = useCallback(async (provider) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error("Supabase social login is not configured yet.");
    }

    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const options = {
      redirectTo,
    };

    if (provider === "google") {
      options.queryParams = {
        access_type: "offline",
        prompt: "consent",
      };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options,
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    removeStorage(PASSWORD_SESSION_KEY);
    setPasswordAuth(null);
    if (!supabase || !isSupabaseConfigured) {
      setSession(null);
      setStoredProfile(readStorage(GUEST_STORAGE_KEY) || {});
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  return (
    <UserContext.Provider
      value={{
        userData,
        setUserData,
        defaultAvatar: DEFAULT_AVATAR,
        authLoading,
        authConfigured: isSupabaseConfigured,
        isAuthenticated: Boolean(session?.user || passwordAuth?.token),
        passwordAuth,
        authProvider: userData.provider,
        loginWithProvider,
        loginWithPassword,
        registerWithPassword,
        signOut,
        session,
        persistProfile,
        resetCustomProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
