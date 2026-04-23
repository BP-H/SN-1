"use client";
import { createContext, useContext, useState } from "react";

const ActiveBEContext = createContext();

export function ActiveBEProvider({ children }) {
  const [activeBE, setActiveBE] = useState(false);
  const lockToLiveBackend = () => setActiveBE(false);

  return (
    <ActiveBEContext.Provider value={{ activeBE: false, setActiveBE: lockToLiveBackend }}>
      {children}
    </ActiveBEContext.Provider>
  );
}

export function useActiveBE() {
  return useContext(ActiveBEContext);
}
