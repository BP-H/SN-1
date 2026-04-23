"use client";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "@/content/header/HeaderWrapper";
import { ActiveBEProvider } from "@/content/ActiveBEContext";
import { UserProvider } from "@/content/profile/UserContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Error from "@/content/Error";
import Notification from "@/content/Notification";
import { useState, useRef, useCallback, createContext } from "react";
import AssistantOrb from "@/content/AssistantOrb";

export const SearchInputContext = createContext({
  inputRef: { current: null },
  focusSearchInput: () => {},
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export default function RootLayout({ children }) {
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef(null);
  const focusSearchInput = useCallback(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${interTight.variable} flex antialiased`} onClick={() => setShowSettings(false)}>
        <QueryClientProvider client={queryClient}>
          {errorMsg.length > 0 && <Error messages={errorMsg} />}
          {notify.length > 0 && <Notification messages={notify} />}
          <SearchInputContext.Provider value={{ inputRef, focusSearchInput }}>
            <UserProvider>
              <ActiveBEProvider>
                <HeaderWrapper
                  showSettings={showSettings}
                  setShowSettings={setShowSettings}
                  setNotify={setNotify}
                  errorMsg={errorMsg}
                  setErrorMsg={setErrorMsg}
                />
                <AssistantOrb />
                {children}
              </ActiveBEProvider>
            </UserProvider>
          </SearchInputContext.Provider>
        </QueryClientProvider>
      </body>
    </html>
  );
}