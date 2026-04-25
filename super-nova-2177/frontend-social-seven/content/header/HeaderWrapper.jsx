"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [authIntent, setAuthIntent] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const { authLoading, isAuthenticated, needsProfileSetup } = useUser();
  const universeMode = pathname?.startsWith("/universe");

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

  useEffect(() => {
    if (!showSettings || authLoading || isAuthenticated) return;
    setAuthIntent({ mode: "create", nonce: Date.now() });
    setShowSettings(false);
    setAccountModalOpen(true);
  }, [authLoading, isAuthenticated, setShowSettings, showSettings]);

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
      {showSettings && isAuthenticated && (
        <div
          className="profile-auth-portal profile-settings-portal fixed inset-0 z-[2147482900] flex items-center justify-center bg-black/65 px-4 py-[max(1.25rem,env(safe-area-inset-top,0px))] backdrop-blur-sm"
          onMouseDown={() => setShowSettings(false)}
        >
          <div
            className="profile-settings-modal-shell w-full max-w-[23rem]"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
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
      {!universeMode && <DesktopNav showSettings={showSettings} setShowSettings={setShowSettings} />}
      {!universeMode && <DesktopRightRail />}
      <AccountModal
        open={accountModalOpen && !isAuthenticated}
        initialMode={authIntent?.mode || "create"}
        onClose={() => setAccountModalOpen(false)}
      />
      <ProfileSetupModal open={needsProfileSetup} />
    </>
  );
}
