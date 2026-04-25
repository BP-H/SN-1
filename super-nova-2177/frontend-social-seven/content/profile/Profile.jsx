import {
  FaBriefcase,
  FaGithub,
  FaPowerOff,
  FaUser,
} from "react-icons/fa";
import { FaFacebookF, FaGoogle } from "react-icons/fa6";
import { BsFillCpuFill } from "react-icons/bs";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoCameraOutline,
  IoClose,
  IoLogInOutline,
  IoMailOutline,
  IoMoonOutline,
  IoShieldCheckmarkOutline,
  IoSunnyOutline,
} from "react-icons/io5";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "./UserContext";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";

const SPECIES = [
  { key: "human", label: "Human", icon: <FaUser />, color: "bg-[#e8457a]" },
  { key: "company", label: "ORG", icon: <FaBriefcase />, color: "bg-[#4a8fe7]" },
  { key: "ai", label: "AI", icon: <BsFillCpuFill />, color: "bg-[#9b6dff]" },
];

const PROVIDERS = [
  { key: "google", label: "Google", icon: <FaGoogle />, color: "#DB4437" },
  { key: "facebook", label: "Facebook", icon: <FaFacebookF />, color: "#4267B2" },
  { key: "github", label: "GitHub", icon: <FaGithub />, color: "#d4d1e1" },
];

function Profile({ setErrorMsg = () => {}, setNotify = () => {}, authIntent = null }) {
  const {
    userData,
    setUserData,
    defaultAvatar,
    authLoading,
    authConfigured,
    isAuthenticated,
    loginWithProvider,
    loginWithPassword,
    registerWithPassword,
    signOut,
    passwordAuth,
  } = useUser();

  const [selectedSpecies, setSelectedSpecies] = useState(userData.species || "human");
  const [avatarUrl, setAvatarUrl] = useState(userData.avatar || "");
  const [authBusy, setAuthBusy] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [authOpen, setAuthOpen] = useState(false);
  const [passwordMode, setPasswordMode] = useState("login");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSelectedSpecies(userData.species || "human");
    setAvatarUrl(userData.avatar || "");
  }, [userData]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("supernova-theme") || "dark";
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!authIntent || isAuthenticated) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("supernova:open-account", {
          detail: { mode: authIntent.mode === "login" ? "login" : "create" },
        })
      );
    }
  }, [authIntent, isAuthenticated]);

  const providerLabel = useMemo(() => {
    if (!isAuthenticated) return "Guest";
    return (userData.provider || "account").replace(/^\w/, (char) => char.toUpperCase());
  }, [isAuthenticated, userData.provider]);

  const currentName = userData.name || "";
  const accountUsername = passwordAuth?.username || currentName;
  const accountId = passwordAuth?.id || userData.id || "";
  const avatarPreview = isAuthenticated
    ? avatarDisplayUrl(avatarUrl || userData.avatar, defaultAvatar)
    : defaultAvatar;
  const openAuth = (mode) => {
    if (!isAuthenticated && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("supernova:open-account", {
          detail: { mode: mode === "login" ? "login" : "create" },
        })
      );
      return;
    }
    setPasswordMode(mode);
    setAuthOpen(true);
  };

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

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    const username = accountName.trim();
    const email = accountEmail.trim();
    const password = accountPassword;
    const errors = [];

    if (!username) errors.push("Username is required.");
    if (passwordMode === "create" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Enter a valid email for account recovery later.");
    }
    if (!password) errors.push("Password is required.");
    if (passwordMode === "create" && password.length < 6) {
      errors.push("Use at least 6 characters for now.");
    }
    if (errors.length) {
      setErrorMsg(errors);
      return;
    }

    setAuthBusy(passwordMode);
    setErrorMsg([]);
    setNotify([]);
    try {
      if (passwordMode === "create") {
        await registerWithPassword({
          username,
          password,
          email,
          species: selectedSpecies || "human",
        });
        setNotify(["Account created and signed in."]);
      } else {
        await loginWithPassword({ username, password });
        setNotify(["Signed in."]);
      }
      setAccountPassword("");
      setAuthOpen(false);
    } catch (error) {
      setErrorMsg([error.message || "Account action failed."]);
    } finally {
      setAuthBusy("");
    }
  }

  async function handleAvatarSelect(event) {
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      }
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setErrorMsg(["Choose an image file for your profile photo."]);
      event.target.value = "";
      return;
    }

    setSaveBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (accountUsername) {
        formData.append("username", accountUsername);
      }
      if (accountId) {
        formData.append("user_id", String(accountId));
      }
      const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload avatar.");
      const data = await response.json();
      if (!data?.url) throw new Error("Avatar upload did not return an image URL.");
      const nextAvatar = normalizeAvatarValue(data.url);

      if (!data.profile_synced && accountUsername) {
        const syncResponse = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(accountUsername)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatar_url: nextAvatar,
            species: selectedSpecies || "human",
          }),
        });
        if (!syncResponse.ok) {
          const syncPayload = await syncResponse.json().catch(() => ({}));
          throw new Error(syncPayload?.detail || "Profile photo uploaded, but account sync failed.");
        }
      }

      setAvatarUrl(nextAvatar);
      setUserData({
        name: currentName || accountUsername,
        species: selectedSpecies || "human",
        avatar: nextAvatar,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("supernova:profile-avatar-updated", {
            detail: { username: accountUsername || currentName, avatar: nextAvatar },
          })
        );
      }
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      setNotify(["Profile photo updated."]);
    } catch (error) {
      setErrorMsg([error.message || "Avatar upload failed."]);
    } finally {
      setSaveBusy(false);
      event.target.value = "";
    }
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

  function applyTheme(nextTheme) {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("supernova-theme", nextTheme);
    }
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <div
      className={`profile-compact-card w-full rounded-[1.05rem] p-3 text-[var(--text-black)] ${
        isAuthenticated ? "" : "cursor-pointer"
      }`}
      role={isAuthenticated ? undefined : "button"}
      tabIndex={isAuthenticated ? undefined : 0}
      onClick={() => {
        if (!isAuthenticated) openAuth("create");
      }}
      onKeyDown={(event) => {
        if (!isAuthenticated && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openAuth("create");
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <img
            src={avatarPreview}
            alt="Avatar"
            onError={(event) => {
              event.currentTarget.src = defaultAvatar;
            }}
            className="h-14 w-14 rounded-full border border-[var(--horizontal-line)] object-cover"
          />
          {isAuthenticated && (
            <>
              <label
                htmlFor="avatarInputSocialSeven"
                className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] ${
                  saveBusy ? "pointer-events-none opacity-70" : "cursor-pointer"
                }`}
                title="Upload profile photo"
                onClick={(event) => event.stopPropagation()}
              >
                <IoCameraOutline />
              </label>
              <input
                type="file"
                id="avatarInputSocialSeven"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.98rem] font-black">{isAuthenticated ? currentName : "SuperNova account"}</p>
          <p className="mt-0.5 truncate text-[0.7rem] text-[var(--text-gray-light)]">
            {authLoading ? "Checking account..." : isAuthenticated ? `${providerLabel} account` : "Sign in to sync across devices"}
          </p>
        </div>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={authBusy === "signout"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[var(--text-gray-light)] disabled:opacity-50"
            aria-label="Sign out"
          >
            <FaPowerOff />
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openAuth("create");
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
            aria-label="Sign in"
          >
            <IoLogInOutline />
          </button>
        )}
      </div>

      {isAuthenticated && (
        <div className="mt-3 flex items-center justify-between rounded-full bg-white/[0.055] px-3 py-2">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-gray-light)]">
            Species
          </span>
          <span className="rounded-full bg-[var(--pink)] px-3 py-1 text-[0.72rem] font-bold text-white">
            {selectedSpecies === "company" ? "ORG" : selectedSpecies === "ai" ? "AI" : "Human"}
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {["dark", "light"].map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              applyTheme(mode);
            }}
            className={`flex h-10 items-center justify-center gap-2 rounded-full px-3 text-[0.74rem] font-semibold capitalize ${
              theme === mode
                ? "bgPink text-white shadow-[var(--shadow-pink)]"
                : "bgGray text-[var(--text-black)]"
            }`}
          >
            {mode === "dark" ? <IoMoonOutline /> : <IoSunnyOutline />}
            {mode}
          </button>
        ))}
      </div>

      {mounted && authOpen && createPortal(
        <div
          className="profile-auth-portal fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/65 px-4 py-[max(1.25rem,env(safe-area-inset-top,0px))] backdrop-blur-sm"
          onClick={() => setAuthOpen(false)}
        >
          <form
            onSubmit={handlePasswordSubmit}
            className="profile-auth-card hide-scrollbar w-full max-w-[24rem] overflow-y-auto rounded-[1.35rem] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.48)]"
            style={{ maxHeight: "calc(100dvh - 2.5rem)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[1rem] font-black">SuperNova account</p>
                <p className="auth-muted mt-0.5 text-[0.7rem]">Sign in or create your synced identity.</p>
              </div>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="auth-icon-button flex h-9 w-9 items-center justify-center rounded-full"
                aria-label="Close account panel"
              >
                <IoClose />
              </button>
            </div>

            <div className="auth-segment mb-3 grid grid-cols-2 rounded-full p-1 text-[0.74rem] font-bold">
              {["login", "create"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPasswordMode(mode)}
                  className={`rounded-full px-3 py-2 ${
                    passwordMode === mode ? "bg-[var(--pink)] text-white" : "auth-muted"
                  }`}
                >
                  {mode === "create" ? "Sign up" : "Sign in"}
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => handleProviderLogin(provider.key)}
                  disabled={Boolean(authBusy)}
                  className="auth-provider-button flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.82rem] font-bold disabled:opacity-45"
                  title={`Continue with ${provider.label}`}
                >
                  <span className="text-[1rem]" style={{ color: provider.color }}>
                    {authBusy === provider.key ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      provider.icon
                    )}
                  </span>
                  Continue with {provider.label}
                </button>
              ))}
            </div>

            <div className="auth-divider my-3 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
              <span className="h-px flex-1" />
              <span>Email</span>
              <span className="h-px flex-1" />
            </div>

            <div className="grid gap-2">
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
                placeholder="Username"
                autoComplete="username"
              />
              {passwordMode === "create" && (
                <input
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                />
              )}
              <input
                value={accountPassword}
                onChange={(event) => setAccountPassword(event.target.value)}
                className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
                placeholder="Password"
                type="password"
                autoComplete={passwordMode === "create" ? "new-password" : "current-password"}
              />
            </div>

            {passwordMode === "create" && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SPECIES.map((item) => {
                  const selected = selectedSpecies === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedSpecies(item.key)}
                      className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[0.72rem] font-semibold ${
                        selected ? `${item.color} text-white` : "auth-pill-inactive"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              disabled={Boolean(authBusy)}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--pink)] text-[0.82rem] font-black text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
            >
              {passwordMode === "create" ? <IoMailOutline /> : <IoShieldCheckmarkOutline />}
              {authBusy === passwordMode ? "Working..." : passwordMode === "create" ? "Create account" : "Sign in"}
            </button>
            {!authConfigured && (
              <p className="auth-muted mt-2 text-center text-[0.66rem] leading-4">
                Provider login is ready in the UI and needs Supabase provider keys in the environment.
              </p>
            )}
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Profile;
