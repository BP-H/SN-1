"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaBriefcase, FaGithub, FaUser } from "react-icons/fa";
import { FaFacebookF, FaGoogle } from "react-icons/fa6";
import {
  IoClose,
  IoMailOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { useUser } from "./UserContext";
import { avatarDisplayUrl } from "@/utils/avatar";
import { formatBackendAuthErrorMessage } from "@/utils/authSession";
import { useI18n } from "@/content/i18n/LocaleContext";
import { speciesAccentBgClass, speciesAvatarStyle } from "@/utils/species";

const SPECIES = [
  { key: "human", labelKey: "account.human", icon: <FaUser /> },
  { key: "company", labelKey: "account.org", icon: <FaBriefcase /> },
];

const PROVIDERS = [
  { key: "google", label: "Google", icon: <FaGoogle />, color: "#DB4437" },
  { key: "facebook", label: "Facebook", icon: <FaFacebookF />, color: "#4267B2" },
  { key: "github", label: "GitHub", icon: <FaGithub />, color: "#d4d1e1" },
];

// Static species guardrail for backend release tests: AI remains a protocol species.

export default function AccountModal({ open, initialMode = "login", onClose = () => {} }) {
  const { t } = useI18n();
  const {
    authConfigured,
    defaultAvatar,
    isAuthenticated,
    loginWithProvider,
    loginWithPassword,
    registerWithPassword,
  } = useUser();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState(initialMode === "login" ? "login" : "create");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [species, setSpecies] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode === "login" ? "login" : "create");
    setError("");
  }, [initialMode, open]);

  useEffect(() => {
    if (isAuthenticated && open) onClose();
  }, [isAuthenticated, onClose, open]);

  if (!mounted || !open) return null;
  const avatarStyle = speciesAvatarStyle(species || "human");
  const alternateMode = mode === "create" ? "login" : "create";
  const switchPrompt = mode === "create" ? t("account.alreadyHaveAccount") : t("account.needAccount");
  const switchLabel = mode === "create" ? t("account.signIn") : t("account.createAccount");

  const submit = async (event) => {
    event.preventDefault();
    const nextUsername = username.trim();
    const nextEmail = email.trim();
    const nextPassword = password;
    if (!nextUsername) {
      setError(t("account.chooseUsername"));
      return;
    }
    if (mode === "create" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError(t("account.enterValidEmail"));
      return;
    }
    if (!nextPassword || (mode === "create" && nextPassword.length < 6)) {
      setError(mode === "create" ? t("account.passwordTooShort") : t("account.enterPassword"));
      return;
    }
    if (mode === "create" && !species) {
      setError(t("account.chooseHumanOrOrg"));
      return;
    }

    setBusy(mode);
    setError("");
    try {
      if (mode === "create") {
        await registerWithPassword({
          username: nextUsername,
          email: nextEmail,
          password: nextPassword,
          species,
        });
      } else {
        await loginWithPassword({ username: nextUsername, password: nextPassword });
      }
      setPassword("");
      onClose();
    } catch (err) {
      setError(formatBackendAuthErrorMessage(err, t("account.accountActionFailed")));
    } finally {
      setBusy("");
    }
  };

  const providerLogin = async (provider) => {
    setBusy(provider);
    setError("");
    try {
      await loginWithProvider(provider);
    } catch (err) {
      setError(formatBackendAuthErrorMessage(err, t("account.unableProviderLogin", { provider })));
      setBusy("");
    }
  };

  return createPortal(
    <div
      className="profile-auth-portal fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/65 px-4 py-[max(1.25rem,env(safe-area-inset-top,0px))] backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="profile-auth-card hide-scrollbar w-full max-w-[24rem] overflow-y-auto rounded-[1.35rem] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.48)]"
        style={{ maxHeight: "calc(100dvh - 2.5rem)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={defaultAvatar} alt="" className="h-12 w-12 shrink-0 rounded-full border object-cover" style={avatarStyle} />
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-black">{t("account.supernovaAccount")}</p>
              <p className="auth-muted mt-0.5 text-[0.7rem]">
                {mode === "create" ? t("account.chooseUsernameAndPrincipal") : t("account.signInToSync")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="auth-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label={t("account.closeAccountPanel")}
          >
            <IoClose />
          </button>
        </div>
        <p className="auth-muted mb-3 rounded-[1rem] px-3 py-2 text-[0.72rem] leading-5">
          SuperNova is nonprofit public-interest infrastructure for contribution records. Create your profile, then review, vote, discuss, ratify, and collaborate. No tokens, equity, payouts, compensation promises, or financial reward guarantees.
        </p>

        <div className="grid gap-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.key}
              type="button"
              onClick={() => providerLogin(provider.key)}
              disabled={Boolean(busy) || !authConfigured}
              className="auth-provider-button flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.82rem] font-bold disabled:opacity-45"
              title={authConfigured ? t("account.continueWith", { provider: provider.label }) : t("account.providerDisabledTitle")}
            >
              <span className="text-[1rem]" style={{ color: provider.color }}>{provider.icon}</span>
              {t("account.continueWith", { provider: provider.label })}
            </button>
          ))}
        </div>

        <div className="auth-divider my-3 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
          <span className="h-px flex-1" />
          <span>{t("account.account")}</span>
          <span className="h-px flex-1" />
        </div>

        <div className="grid gap-2">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
            placeholder={t("account.username")}
            autoComplete="username"
          />
          {mode === "create" && (
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
              placeholder={t("account.email")}
              type="email"
              autoComplete="email"
            />
          )}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
            placeholder={t("account.password")}
            type="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
          />
        </div>

        {mode === "create" && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SPECIES.map((item) => {
                const selected = species === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSpecies(item.key)}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[0.72rem] font-semibold ${
                      selected ? `${speciesAccentBgClass(item.key)} text-white` : "auth-pill-inactive"
                    }`}
                  >
                    {item.icon}
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
            <p className="auth-muted mt-2 rounded-[0.85rem] px-3 py-2 text-[0.7rem] leading-5">
              {t("account.speciesAiNote")}
            </p>
          </>
        )}

        {error && <p className="auth-error mt-3 rounded-[0.85rem] px-3 py-2 text-[0.76rem]">{error}</p>}

        <button
          type="submit"
          disabled={Boolean(busy)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--pink)] text-[0.82rem] font-black text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          {mode === "create" ? <IoMailOutline /> : <IoShieldCheckmarkOutline />}
          {busy === mode ? t("account.working") : mode === "create" ? t("account.createAccount") : t("account.signIn")}
        </button>
        <p className="auth-muted mt-3 text-center text-[0.72rem] font-semibold">
          {switchPrompt}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode(alternateMode);
            }}
            className="font-black text-[var(--pink)]"
            disabled={Boolean(busy)}
          >
            {switchLabel}
          </button>
        </p>
        {!authConfigured && (
          <p className="auth-muted mt-2 text-center text-[0.66rem] leading-4">
            {t("account.providerEnvNote")}
          </p>
        )}
      </form>
    </div>,
    document.body
  );
}

export function ProfileSetupModal({ open }) {
  const { t } = useI18n();
  const {
    defaultAvatar,
    userData,
    syncSocialProfile,
    signOut,
  } = useUser();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [species, setSpecies] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const fallbackName = (userData?.email || "").split("@")[0] || userData?.name || "";
    setUsername((current) => current || fallbackName.replace(/[^\w.-]+/g, "").slice(0, 40));
    setSpecies((current) => current || "");
    setError("");
  }, [open, userData?.email, userData?.name]);

  if (!mounted || !open) return null;
  const avatarStyle = speciesAvatarStyle(species || userData?.species || "human");

  const submit = async (event) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError(t("account.chooseUsername"));
      return;
    }
    if (!species) {
      setError(t("account.chooseHumanOrOrg"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await syncSocialProfile({
        username: cleanUsername,
        species,
        avatar: userData?.avatar || "",
      });
    } catch (err) {
      setError(formatBackendAuthErrorMessage(err, t("account.finishSetupFailed")));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="profile-auth-portal fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/65 px-4 py-[max(1.25rem,env(safe-area-inset-top,0px))] backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="profile-auth-card hide-scrollbar w-full max-w-[24rem] overflow-y-auto rounded-[1.35rem] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.48)]"
        style={{ maxHeight: "calc(100dvh - 2.5rem)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={userData?.avatar ? avatarDisplayUrl(userData.avatar, defaultAvatar) : defaultAvatar}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border object-cover"
              style={avatarStyle}
            />
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-black">{t("account.chooseIdentity")}</p>
              <p className="auth-muted mt-0.5 text-[0.7rem]">{t("account.choosePrincipal")}</p>
            </div>
          </div>
        </div>

        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="auth-input h-11 w-full rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
          placeholder={t("account.username")}
          autoComplete="username"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          {SPECIES.map((item) => {
            const selected = species === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSpecies(item.key)}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[0.72rem] font-semibold ${
                  selected ? `${speciesAccentBgClass(item.key)} text-white` : "auth-pill-inactive"
                }`}
              >
                {item.icon}
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
        <p className="auth-muted mt-2 rounded-[0.85rem] px-3 py-2 text-[0.7rem] leading-5">
          {t("account.socialAiNote")}
        </p>

        {error && <p className="auth-error mt-3 rounded-[0.85rem] px-3 py-2 text-[0.76rem]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--pink)] text-[0.82rem] font-black text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          <IoShieldCheckmarkOutline />
          {busy ? t("account.saving") : t("account.continue")}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="auth-muted mt-3 w-full text-center text-[0.72rem] font-semibold"
        >
          {t("account.signOutInstead")}
        </button>
      </form>
    </div>,
    document.body
  );
}
