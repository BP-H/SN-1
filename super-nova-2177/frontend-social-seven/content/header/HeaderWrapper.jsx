"use client";
import Header from "@/content/header/Header";
import HeaderMobile from "@/content/header/HeaderMobile";
import Settings from "@/content/header/content/Settings";

export default function HeaderWrapper({
  setErrorMsg,
  errorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
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
        <div className="pointer-events-none fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[9055] w-[min(calc(100vw-1rem),22rem)] -translate-x-1/2 px-2">
          <div className="pointer-events-auto">
            <Settings
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
    </>
  );
}
