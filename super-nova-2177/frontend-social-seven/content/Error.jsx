"use client";

import { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";

export default function Error({ messages }) {
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
      }, 6500)
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [visibleMessages]);

  const dismiss = (message) => {
    setVisibleMessages((prevMessages) => prevMessages.filter((item) => item !== message));
  };

  if (!visibleMessages.length) return null;

  return (
    <div className="supernova-toast-stack">
      {visibleMessages.map((message, index) => (
        <div
          key={`${message}-${index}`}
          className="supernova-toast supernova-toast-error flex items-center gap-2 px-4 py-2.5 text-[0.78rem] font-semibold"
        >
          <p className="min-w-0 flex-1 truncate" title={message}>{message}</p>
          <button
            type="button"
            onClick={() => dismiss(message)}
            aria-label="Dismiss error"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-current opacity-70 transition-opacity hover:opacity-100"
          >
            <IoClose />
          </button>
        </div>
      ))}
    </div>
  );
}
