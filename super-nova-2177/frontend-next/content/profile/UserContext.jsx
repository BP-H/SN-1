"use client";
import { createContext, useState, useContext, useEffect, useCallback } from "react";

const UserContext = createContext();

const STORAGE_KEY = "supernova_user";
const DEFAULT_AVATAR = "/default-avatar.png";

function calculateInitials(name) {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts.map(part => part[0].toUpperCase()).join("");
  } else if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "";
}

function loadFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function UserProvider({ children }) {
  const [userData, setUserDataRaw] = useState({
    species: "",
    avatar: "",
    name: "",
    initials: "",
  });

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved && saved.name) {
      setUserDataRaw({
        species: saved.species || "",
        avatar: saved.avatar || "",
        name: saved.name || "",
        initials: calculateInitials(saved.name || ""),
      });
    }
  }, []);

  const setUserData = useCallback((update) => {
    setUserDataRaw((prev) => {
      const next = typeof update === "function" ? update(prev) : { ...prev, ...update };
      // Always recalculate initials from the name
      next.initials = calculateInitials(next.name || "");
      saveToStorage(next);
      return next;
    });
  }, []);

  const defaultAvatar = DEFAULT_AVATAR;

  return (
    <UserContext.Provider value={{ userData, setUserData, defaultAvatar }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}