import content from "@/assets/content.json";
import { FaUser, FaBriefcase, FaGithub, FaCloudUploadAlt, FaPowerOff } from "react-icons/fa";
import { BsFillCpuFill } from "react-icons/bs";
import { useEffect, useMemo, useState } from "react";
import { IoClose } from "react-icons/io5";
import { FaFacebookF, FaGoogle } from "react-icons/fa6";
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

  useEffect(() => {
    setSelectedSpecies(userData.species || "human");
    setDisplayName(userData.name || "");
    setAvatarUrl(userData.avatar || "");
  }, [userData]);

  const providerLabel = useMemo(() => {
    if (!isAuthenticated) return "Guest";
    return (userData.provider || "oauth")
      .replace(/^\w/, (char) => char.toUpperCase());
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

  return (
    <div className="text-[var(--text-black)] bgWhiteTrue shadow-lg p-5 sm:p-6 rounded-[28px] w-full max-w-[26rem] mx-auto relative overflow-hidden border border-white/40">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.35rem] font-black tracking-tight">{settings.profile}</h1>
          <p className="text-[0.82rem] opacity-60 leading-relaxed max-w-[260px]">
            Social-first identity. Your provider photo and
            name sync automatically, and you can customize both.
          </p>
        </div>
        <div className="rounded-full bg-white/60 shadow-sm border border-white/40 px-3 py-2 text-[0.7rem] font-bold text-[var(--text-black)]">
          {authLoading ? "Checking session..." : providerLabel}
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-6 border-b border-gray-200/50 pb-6">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.key}
            onClick={() => handleProviderLogin(provider.key)}
            disabled={!authConfigured || Boolean(authBusy)}
            title={provider.label}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-[1.25rem] shadow-sm border border-gray-100 hover:-translate-y-1 hover:shadow-lg hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
            style={{ color: provider.key === 'google' ? '#DB4437' : provider.key === 'facebook' ? '#4267B2' : '#333' }}
          >
            {authBusy === provider.key ? (
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />
            ) : (
              provider.icon
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{settings.species}</h2>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(settings.types).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedSpecies(key)}
                className={`flex hover:-translate-y-1 transition-transform cursor-pointer rounded-2xl p-1.5 pr-3 items-center gap-2 shadow-sm border ${
                  selectedSpecies === key ? "bg-[var(--pink)] border-[var(--pink)] text-white shadow-md shadow-[var(--shadow-pink)]" : "bg-white/60 border-white/40 text-[var(--text-black)] hover:bg-white"
                }`}
              >
                  <div className={`text-base rounded-xl w-9 h-9 flex items-center justify-center shadow-sm ${selectedSpecies === key ? "bg-white/20" : "bg-white"}`}>
                  <span>{typeIcons[key]}</span>
                </div>
                <p className="font-bold text-[0.78rem]">{label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start gap-6">
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{settings.avatar}</h2>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                {avatarUrl ? (
                  <div className="relative group">
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white"
                    />
                    <button
                      onClick={() => setAvatarUrl("")}
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 transition-colors rounded-full text-white text-xs w-6 h-6 flex items-center justify-center shadow-md cursor-pointer"
                    >
                      <IoClose />
                    </button>
                  </div>
                ) : (
                  <div className="bg-white items-center justify-center flex font-black text-lg rounded-full w-14 h-14 shadow-md border-2 border-white text-[var(--blue)]">
                    {userData.initials || "SN"}
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="avatarInputSocialSix"
                    className="rounded-full bg-[var(--blue)] hover:bg-blue-600 transition-colors px-4 py-2 text-white shadow-md cursor-pointer flex items-center gap-2 text-[0.78rem] font-bold"
                  >
                    <FaCloudUploadAlt className="text-lg" />
                    {saveBusy ? "Uploading..." : "Upload Photo"}
                  </label>
                  <input
                    type="file"
                    id="avatarInputSocialSix"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                  {userData.providerAvatar && (
                    <button
                      onClick={useProviderPhoto}
                      className="rounded-full bg-white/60 hover:bg-white transition-colors border border-gray-200 px-4 py-2 text-[0.72rem] font-bold shadow-sm"
                    >
                      Use Provider Photo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full min-w-[200px] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{settings.name}</h2>
            <input
              className="bg-white/80 focus:bg-white focus:ring-2 focus:ring-[var(--pink)] outline-none transition-all rounded-2xl h-12 text-[0.95rem] px-4 w-full shadow-inner border border-white/40"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
            {userData.email && (
              <p className="text-xs font-medium text-gray-400 pl-2">
                Connected email: {userData.email}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-5 border-t border-gray-200/50 flex-wrap">
          <button
            onClick={handleSaveProfile}
            className="bg-[var(--pink)] hover:bg-pink-600 transition-colors shadow-md shadow-[var(--shadow-pink)] text-[0.8rem] font-bold rounded-full text-white hover:-translate-y-0.5 py-2.5 px-5"
          >
            Save Profile
          </button>
          <button
            onClick={handleResetProfile}
            className="bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 shadow-sm border border-gray-200 text-[0.8rem] font-bold rounded-full hover:-translate-y-0.5 py-2.5 px-5"
          >
            Reset
          </button>
          {isAuthenticated && (
            <button
              onClick={handleSignOut}
            className="ml-auto bg-gray-800 hover:bg-black transition-colors text-white shadow-md text-[0.8rem] font-bold rounded-full hover:-translate-y-0.5 py-2.5 px-5 flex items-center gap-2"
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
