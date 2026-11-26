"use client";

import Link from "next/link";
import { useState } from "react";
import ErrorBanner from "@/content/Error";
import Notification from "@/content/Notification";
import Profile from "@/content/profile/Profile";

export default function ProfilePage() {
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);

  return (
    <div className="social-shell px-3 pb-6">
      {errorMsg.length > 0 && <ErrorBanner messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}

      <div className="mb-4">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[var(--pink)]">
          Profile
        </p>
        <h1 className="mt-2 text-[1.5rem] font-black">Your SuperNova identity</h1>
        <Link href="/settings/shop" className="mt-3 inline-block font-semibold text-[var(--pink)]">Set up or manage my shop</Link>
      </div>

      <div className="flex justify-center">
        <Profile setErrorMsg={setErrorMsg} setNotify={setNotify} />
      </div>
    </div>
  );
}
