"use client";
import { useEffect, useState } from "react";
import Header from "@/content/header/Header";
import HeaderMobile from "@/content/header/HeaderMobile";
import DesktopNav from "@/content/header/DesktopNav";
import DesktopRightRail from "@/content/header/DesktopRightRail";
import Settings from "@/content/header/content/Settings";
import AccountModal, { ProfileSetupModal } from "@/content/profile/AccountModal";
import { useUser } from "@/content/profile/UserContext";

export default function HeaderWrapper({
  setErrorMsg,
  errorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
  const [authIntent, setAuthIntent] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const { isAuthenticated, needsProfileSetup } = useUser();

  useEffect(() => {
    const openAccount = (event) => {
      setAuthIntent({
        mode: event.detail?.mode === "login" ? "login" : "create",
        nonce: Date.now(),
      });
      setErrorMsg([]);
      setShowSettings(false);
      setAccountModalOpen(true);
    };
    window.addEventListener("supernova:open-account", openAccount);
    return () => window.removeEventListener("supernova:open-account", openAccount);
  }, [setErrorMsg, setShowSettings]);

  return (
    <>
      <Header
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        setNotify={setNotify}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
      <span id="createPost"></span>
      {showSettings && (
        <div className="mobile-settings-sheet pointer-events-none fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[9200] w-[min(calc(100vw-1.25rem),21rem)] -translate-x-1/2 px-0">
          <div className="pointer-events-auto">
            <Settings
              authIntent={authIntent}
              setNotify={setNotify}
              errorMsg={errorMsg}
              setErrorMsg={setErrorMsg}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
      <HeaderMobile
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        setNotify={setNotify}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
      <DesktopNav showSettings={showSettings} setShowSettings={setShowSettings} />
      <DesktopRightRail />
      <AccountModal
        open={accountModalOpen && !isAuthenticated}
        initialMode={authIntent?.mode || "create"}
        onClose={() => setAccountModalOpen(false)}
      />
      <ProfileSetupModal open={needsProfileSetup} />
    </>
  );
}
