"use client";

import { createContext, useState, useContext, useEffect, useCallback, useMemo } from "react";
import supabase, { isSupabaseConfigured } from "@/supabaseClient";

const UserContext = createContext();

const GUEST_STORAGE_KEY = "supernova_social_six_guest";
const CUSTOM_STORAGE_PREFIX = "supernova_social_six_custom::";
const DEFAULT_AVATAR = "/default-avatar.png";

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

function getCustomStorageKey(authUser) {
  if (!authUser?.id) return GUEST_STORAGE_KEY;
  return `${CUSTOM_STORAGE_PREFIX}${authUser.id}`;
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
    avatar: metadata.avatar_url || metadata.picture || "",
    provider,
  };
}

function mergeUserData(providerProfile, storedProfile = {}) {
  const effectiveName = storedProfile.customName || providerProfile.name || "";
  const effectiveAvatar = storedProfile.customAvatar || providerProfile.avatar || "";
  const species = storedProfile.species || "human";

  return {
    id: providerProfile.id,
    email: providerProfile.email || "",
    provider: providerProfile.provider || "guest",
    isAuthenticated: Boolean(providerProfile.id),
    species,
    avatar: effectiveAvatar,
    providerAvatar: providerProfile.avatar || "",
    name: effectiveName,
    providerName: providerProfile.name || "",
    initials: calculateInitials(effectiveName || providerProfile.email || ""),
  };
}

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [storedProfile, setStoredProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const authUser = session?.user ?? null;
  const providerProfile = useMemo(() => getProviderProfile(authUser), [authUser]);

  useEffect(() => {
    const initialStored = readStorage(GUEST_STORAGE_KEY) || {};
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
      const key = getCustomStorageKey(nextSession?.user ?? null);
      setStoredProfile(readStorage(key) || {});
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      const key = getCustomStorageKey(nextSession?.user ?? null);
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

  const persistProfile = useCallback((nextStored) => {
    const key = getCustomStorageKey(authUser);
    writeStorage(key, nextStored);
    setStoredProfile(nextStored);
  }, [authUser]);

  const setUserData = useCallback((update) => {
    setStoredProfile((prev) => {
      const previous = prev || {};
      const current = mergeUserData(providerProfile, previous);
      const patch = typeof update === "function" ? update(current) : update;
      const nextStored = {
        species: patch?.species || current.species || "human",
        customName: typeof patch?.name === "string" ? patch.name : previous.customName || "",
        customAvatar: typeof patch?.avatar === "string" ? patch.avatar : previous.customAvatar || "",
      };
      const key = getCustomStorageKey(authUser);
      writeStorage(key, nextStored);
      return nextStored;
    });
  }, [authUser, providerProfile]);

  const resetCustomProfile = useCallback(() => {
    const key = getCustomStorageKey(authUser);
    removeStorage(key);
    setStoredProfile({});
  }, [authUser]);

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
        isAuthenticated: Boolean(session?.user),
        authProvider: userData.provider,
        loginWithProvider,
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
