import { useEffect, useRef } from "react";
import Profile from "@/content/profile/Profile";

export default function Settings({ errorMsg, setErrorMsg, setNotify, onClose, authIntent }) {
  const settingsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (event.target.closest("[data-mobile-nav]")) {
        return;
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={settingsRef}
      className="mobile-settings-card w-full max-w-[21.5rem]"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="profile-settings-glass-shell w-full">
        <div className="profile-settings-glass-effect" />
        <div className="profile-settings-glass-tint" />
        <div className="profile-settings-glass-shine" />
        <div
          onClick={(event) => event.stopPropagation()}
          className="profile-settings-inner relative z-[2] w-full"
        >
          <Profile
            errorMsg={errorMsg}
            setErrorMsg={setErrorMsg}
            setNotify={setNotify}
            authIntent={authIntent}
          />
        </div>
      </div>
    </div>
  );
}
