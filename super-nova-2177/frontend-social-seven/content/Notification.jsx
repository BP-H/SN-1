"use client";

import { useEffect, useState } from "react";

export default function Notification({ messages }) {
  const [visibleMessages, setVisibleMessages] = useState([]);

  useEffect(() => {
    if (!messages?.length) return;
    setVisibleMessages((prevMessages) => {
      const nextMessages = messages.filter((message) => !prevMessages.includes(message));
      return [...prevMessages, ...nextMessages].slice(-2);
    });
  }, [messages]);

  useEffect(() => {
    if (visibleMessages.length === 0) return undefined;
    const timers = visibleMessages.map((message) =>
      setTimeout(() => {
        setVisibleMessages((prevMessages) => prevMessages.filter((item) => item !== message));
      }, 3600)
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [visibleMessages]);

  if (!visibleMessages.length) return null;

  return (
    <div className="supernova-toast-stack">
      {visibleMessages.map((message, index) => (
        <div
          key={`${message}-${index}`}
          className="supernova-toast supernova-toast-success px-4 py-2.5 text-[0.78rem] font-semibold"
        >
          <p className="truncate">{message}</p>
        </div>
      ))}
    </div>
  );
}
