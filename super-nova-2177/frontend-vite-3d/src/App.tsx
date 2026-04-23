// src/App.tsx
import React from "react";
import Shell from "./components/Shell";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import "./styles.css"; // global reset/theme (includes your orb/chat/portal CSS)

export default function App() {
  React.useEffect(() => {
    console.log("App mounted");
  }, []);
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
