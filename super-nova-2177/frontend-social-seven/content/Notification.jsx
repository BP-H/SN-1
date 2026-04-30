"use client";

import { useEffect, useState } from "react";

let notificationCounter = 0;

function createNotificationId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  notificationCounter += 1;
  return `${Date.now()}-${notificationCounter}`;
}

export default function Notification({ messages }) {
  const [visibleMessages, setVisibleMessages] = useState([]);

  useEffect(() => {
    if (!messages?.length) return;
    setVisibleMessages((prevMessages) => {
      const nextMessages = messages
        .map((message) => String(message || "").trim())
        .filter(Boolean)
        .map((message) => ({ id: createNotificationId(), message }));
      return [...prevMessages, ...nextMessages].slice(-2);
    });
  }, [messages]);

  useEffect(() => {
    if (visibleMessages.length === 0) return undefined;
    const timers = visibleMessages.map((item) =>
      setTimeout(() => {
        setVisibleMessages((prevMessages) =>
          prevMessages.filter((visibleItem) => visibleItem.id !== item.id)
        );
      }, 3600)
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [visibleMessages]);

  if (!visibleMessages.length) return null;

  return (
    <div className="supernova-toast-stack">
      {visibleMessages.map((item) => (
        <div
          key={item.id}
          className="supernova-toast supernova-toast-success px-4 py-2.5 text-[0.78rem] font-semibold"
        >
          <p className="truncate">{item.message}</p>
        </div>
      ))}
    </div>
  );
}
