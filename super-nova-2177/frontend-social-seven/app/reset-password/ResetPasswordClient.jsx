"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IoShieldCheckmarkOutline } from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const code = useMemo(() => searchParams.get("code") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const openSignIn = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!code) {
      setError("This password reset link is missing or incomplete.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 password characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to reset password.");
      }
      setPassword("");
      setConfirmPassword("");
      setNotice(payload?.message || "Password updated. You can sign in now.");
    } catch (err) {
      setError(err?.message || "Unable to reset password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="social-shell flex min-h-[calc(100dvh-var(--header-offset)-1rem)] items-center justify-center px-4 py-8">
      <form
        onSubmit={submit}
        className="profile-auth-card w-full max-w-[24rem] rounded-[1.35rem] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]">
            <IoShieldCheckmarkOutline />
          </div>
          <div className="min-w-0">
            <p className="text-[1.05rem] font-black text-[var(--text-black)]">Reset password</p>
            <p className="auth-muted mt-1 text-[0.76rem] leading-5">
              Choose a new password for your SuperNova account.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
            placeholder="New password"
            type="password"
            autoComplete="new-password"
          />
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="auth-input h-11 rounded-[0.95rem] px-3 text-[0.86rem] outline-none"
            placeholder="Confirm new password"
            type="password"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="auth-error mt-3 rounded-[0.85rem] px-3 py-2 text-[0.76rem]">{error}</p>}
        {notice && <p className="auth-muted mt-3 rounded-[0.85rem] px-3 py-2 text-[0.76rem]">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-[var(--pink)] text-[0.82rem] font-black text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          {busy ? "Saving..." : "Save new password"}
        </button>
        <button
          type="button"
          onClick={openSignIn}
          className="mt-3 w-full text-center text-[0.74rem] font-black text-[var(--pink)]"
        >
          Back to sign in
        </button>
      </form>
    </div>
  );
}
