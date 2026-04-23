import content from "@/assets/content.json";
import {
  FaBriefcase,
  FaCloudUploadAlt,
  FaGithub,
  FaPowerOff,
  FaUser,
} from "react-icons/fa";
import { FaFacebookF, FaGoogle } from "react-icons/fa6";
import { BsFillCpuFill } from "react-icons/bs";
import { useEffect, useMemo, useState } from "react";
import { IoClose } from "react-icons/io5";
import { useUser } from "./UserContext";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";

const typeIcons = {
  human: <FaUser />,
  company: <FaBriefcase />,
  ai: <BsFillCpuFill />,
};

const PROVIDERS = [
  { key: "google", label: "Continue with Google", icon: <FaGoogle /> },
  { key: "facebook", label: "Continue with Facebook", icon: <FaFacebookF /> },
  { key: "github", label: "Continue with GitHub", icon: <FaGithub /> },
];

function Profile({ setErrorMsg, setNotify }) {
  const {
    userData,
    setUserData,
    authLoading,
    authConfigured,
    isAuthenticated,
    loginWithProvider,
    signOut,
    resetCustomProfile,
  } = useUser();

  const settings = content.header.profile;
  const [selectedSpecies, setSelectedSpecies] = useState(userData.species || "human");
  const [displayName, setDisplayName] = useState(userData.name || "");
  const [avatarUrl, setAvatarUrl] = useState(userData.avatar || "");
  const [authBusy, setAuthBusy] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setSelectedSpecies(userData.species || "human");
    setDisplayName(userData.name || "");
    setAvatarUrl(userData.avatar || "");
  }, [userData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("supernova-theme") || "dark";
    setTheme(savedTheme);
  }, []);

  const providerLabel = useMemo(() => {
    if (!isAuthenticated) return "Guest";
    return (userData.provider || "oauth").replace(/^\w/, (char) => char.toUpperCase());
  }, [isAuthenticated, userData.provider]);

  async function handleProviderLogin(provider) {
    setErrorMsg([]);
    setNotify([]);
    setAuthBusy(provider);
    try {
      await loginWithProvider(provider);
      setNotify([`Redirecting to ${provider} for login...`]);
    } catch (error) {
      setErrorMsg([error.message || `Unable to start ${provider} login.`]);
    } finally {
      setAuthBusy("");
    }
  }

  async function handleAvatarSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaveBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload avatar.");
      const data = await response.json();
      setAvatarUrl(absoluteApiUrl(data.url));
      setNotify(["Custom avatar uploaded."]);
    } catch (error) {
      setErrorMsg([error.message || "Avatar upload failed."]);
    } finally {
      setSaveBusy(false);
    }
  }

  function handleSaveProfile() {
    const errors = [];
    if (!displayName.trim()) errors.push("Profile name is required.");
    if (!selectedSpecies) errors.push("Pick a species to continue.");
    if (errors.length > 0) {
      setErrorMsg(errors);
      return;
    }

    setErrorMsg([]);
    setUserData({
      name: displayName.trim(),
      species: selectedSpecies,
      avatar: avatarUrl,
    });
    setNotify(["Profile saved."]);
  }

  function handleResetProfile() {
    resetCustomProfile();
    setSelectedSpecies("human");
    setDisplayName(userData.providerName || "");
    setAvatarUrl(userData.providerAvatar || "");
    setNotify(["Profile customizations reset."]);
  }

  async function handleSignOut() {
    setAuthBusy("signout");
    try {
      await signOut();
      setNotify(["Signed out successfully."]);
    } catch (error) {
      setErrorMsg([error.message || "Sign out failed."]);
    } finally {
      setAuthBusy("");
    }
  }

  function useProviderPhoto() {
    if (!userData.providerAvatar) {
      setErrorMsg(["No provider profile photo is available for this account."]);
      return;
    }
    setAvatarUrl(userData.providerAvatar);
    setNotify(["Provider profile photo applied."]);
  }

  function applyTheme(nextTheme) {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("supernova-theme", nextTheme);
    }
    document.documentElement.dataset.theme = nextTheme;
    setNotify([`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`]);
  }

  return (
    <div className="bgWhiteTrue w-full rounded-[1.45rem] p-4 text-[var(--text-black)] shadow-lg sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.2rem] font-black">{settings.profile}</h1>
          <p className="mt-1.5 max-w-[17rem] text-[0.77rem] leading-5 text-[var(--text-gray-light)]">
            Social identity, provider sync, and quick profile customization.
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[0.72rem] font-semibold text-[var(--text-gray-light)]">
          {authLoading ? "Checking..." : providerLabel}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-3 border-b border-[var(--horizontal-line)] pb-4">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.key}
            type="button"
            onClick={() => handleProviderLogin(provider.key)}
            disabled={!authConfigured || Boolean(authBusy)}
            title={provider.label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.04)] text-[1rem] shadow-sm disabled:opacity-50"
            style={{
              color:
                provider.key === "google"
                  ? "#DB4437"
                  : provider.key === "facebook"
                  ? "#4267B2"
                  : "#d4d1e1",
            }}
          >
            {authBusy === provider.key ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "currentColor", borderTopColor: "transparent" }} />
            ) : (
              provider.icon
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="mb-3 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-[var(--text-gray-light)]">
            Theme
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {["dark", "light"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => applyTheme(mode)}
                className={`rounded-[1rem] px-3 py-2.5 text-[0.78rem] font-semibold capitalize ${
                  theme === mode
                    ? "bgPink text-white shadow-[var(--shadow-pink)]"
                    : "bgGray text-[var(--text-black)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-[var(--text-gray-light)]">
            {settings.species}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(settings.types).map(([key, label]) => {
              const bgClass =
                key === "human"
                  ? "bg-[#e8457a]"
                  : key === "company"
                  ? "bg-[#4a8fe7]"
                  : "bg-[#9b6dff]";
              const shadowClass =
                key === "human"
                  ? "shadow-[0_0_12px_rgba(232,69,122,0.4)]"
                  : key === "company"
                  ? "shadow-[0_0_12px_rgba(74,143,231,0.4)]"
                  : "shadow-[0_0_12px_rgba(155,109,255,0.4)]";

              const isSelected = selectedSpecies === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSpecies(key)}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all ${
                    isSelected
                      ? `${bgClass} text-white ${shadowClass} scale-110`
                      : "bg-[rgba(255,255,255,0.06)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.12)]"
                  }`}
                  title={label}
                  aria-label={`Select species: ${label}`}
                >
                  <span className="text-[1.2rem]">{typeIcons[key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-[var(--text-gray-light)]">
            {settings.avatar}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {avatarUrl ? (
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-12 w-12 rounded-full border border-[var(--horizontal-line)] object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pink)] text-white"
                >
                  <IoClose className="text-[0.9rem]" />
                </button>
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.9)] font-black text-[var(--blue)]">
                {userData.initials || "SN"}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <label
                htmlFor="avatarInputSocialSeven"
                className="flex cursor-pointer items-center gap-2 rounded-full bg-[var(--blue)] px-4 py-2 text-[0.74rem] font-semibold text-white shadow-[var(--shadow-blue)]"
              >
                <FaCloudUploadAlt />
                {saveBusy ? "Uploading..." : "Upload Photo"}
              </label>
              <input
                type="file"
                id="avatarInputSocialSeven"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              {userData.providerAvatar && (
                <button
                  type="button"
                  onClick={useProviderPhoto}
                  className="rounded-full bgGray px-4 py-2 text-[0.74rem] font-semibold"
                >
                  Use Provider Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-[var(--text-gray-light)]">
            {settings.name}
          </h2>
          <input
            className="h-11 w-full rounded-[1rem] border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.06)] px-4 text-[0.92rem] outline-none"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
          />
          {userData.email && (
            <p className="mt-2 text-[0.74rem] text-[var(--text-gray-light)]">
              Connected email: {userData.email}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--horizontal-line)] pt-4">
          <button
            type="button"
            onClick={handleSaveProfile}
            className="rounded-full bg-[var(--pink)] px-4 py-2 text-[0.78rem] font-semibold text-white shadow-[var(--shadow-pink)]"
          >
            Save Profile
          </button>
          <button
            type="button"
            onClick={handleResetProfile}
            className="rounded-full bgGray px-4 py-2 text-[0.78rem] font-semibold"
          >
            Reset
          </button>
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.08)] px-4 py-2 text-[0.78rem] font-semibold sm:ml-auto"
            >
              <FaPowerOff />
              {authBusy === "signout" ? "Signing Out..." : "Sign Out"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
