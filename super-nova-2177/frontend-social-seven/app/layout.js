"use client";
import "./globals.css";
import HeaderWrapper from "@/content/header/HeaderWrapper";
import { ActiveBEProvider } from "@/content/ActiveBEContext";
import { UserProvider } from "@/content/profile/UserContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBanner from "@/content/Error";
import Notification from "@/content/Notification";
import { useState, useRef, useCallback, createContext, useEffect } from "react";

export const SearchInputContext = createContext({
  inputRef: { current: null },
  focusSearchInput: () => {},
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

  useEffect(() => {
    const savedTheme =
      typeof window !== "undefined" ? localStorage.getItem("supernova-theme") : null;
    document.documentElement.dataset.theme = savedTheme || "dark";
  }, []);

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased social-six-font">
        <QueryClientProvider client={queryClient}>
          {errorMsg.length > 0 && <ErrorBanner messages={errorMsg} />}
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
                <main className="app-shell w-full">{children}</main>
              </ActiveBEProvider>
            </UserProvider>
          </SearchInputContext.Provider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
