"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaBriefcase, FaGithub, FaUser } from "react-icons/fa";
import { FaFacebookF, FaGoogle } from "react-icons/fa6";
import { BsFillCpuFill } from "react-icons/bs";
import {
  IoClose,
  IoMailOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { useUser } from "./UserContext";

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

export default function AccountModal({ open, initialMode = "create", onClose = () => {} }) {
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

  const submit = async (event) => {
    event.preventDefault();
    const nextUsername = username.trim();
    const nextEmail = email.trim();
    const nextPassword = password;
    if (!nextUsername) {
      setError("Choose a username.");
      return;
    }
    if (mode === "create" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("Enter a valid email.");
      return;
    }
    if (!nextPassword || (mode === "create" && nextPassword.length < 6)) {
      setError(mode === "create" ? "Use at least 6 password characters." : "Enter your password.");
      return;
    }
    if (mode === "create" && !species) {
      setError("Choose Human, ORG, or AI.");
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
      setError(err.message || "Account action failed.");
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
      setError(err.message || `Unable to start ${provider} login.`);
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
            <img src={defaultAvatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-black">SuperNova account</p>
              <p className="auth-muted mt-0.5 text-[0.7rem]">Create your synced identity.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="auth-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label="Close account panel"
          >
            <IoClose />
          </button>
        </div>

        <div className="auth-segment mb-3 grid grid-cols-2 rounded-full p-1 text-[0.74rem] font-bold">
          {["create", "login"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full px-3 py-2 ${mode === item ? "bg-[var(--pink)] text-white" : "auth-muted"}`}
            >
              {item === "create" ? "Sign up" : "Sign in"}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.key}
              type="button"
              onClick={() => providerLogin(provider.key)}
              disabled={Boolean(busy)}
              className="auth-provider-button flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.82rem] font-bold disabled:opacity-45"
            >
              <span className="text-[1rem]" style={{ color: provider.color }}>{provider.icon}</span>
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
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
            placeholder="Username"
            autoComplete="username"
          />
          {mode === "create" && (
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
              placeholder="Email"
              type="email"
              autoComplete="email"
            />
          )}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
            placeholder="Password"
            type="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
          />
        </div>

        {mode === "create" && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SPECIES.map((item) => {
              const selected = species === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSpecies(item.key)}
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

        {error && <p className="auth-error mt-3 rounded-[0.85rem] px-3 py-2 text-[0.76rem]">{error}</p>}

        <button
          type="submit"
          disabled={Boolean(busy)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--pink)] text-[0.82rem] font-black text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          {mode === "create" ? <IoMailOutline /> : <IoShieldCheckmarkOutline />}
          {busy === mode ? "Working..." : mode === "create" ? "Create account" : "Sign in"}
        </button>
        {!authConfigured && (
          <p className="auth-muted mt-2 text-center text-[0.66rem] leading-4">
            Provider login is ready in the UI and needs Supabase provider keys in the environment.
          </p>
        )}
      </form>
    </div>,
    document.body
  );
}
