"use client";
import { useState, useEffect } from "react";

export default function Notification({ messages }) {
  const [visibleMessages, setVisibleMessages] = useState([]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      setVisibleMessages((prevMessages) => {
        // Adiciona novas mensagens que ainda não estão visíveis
        const newMessages = messages.filter(
          (msg) => !prevMessages.includes(msg)
        );
        return [...prevMessages, ...newMessages];
      });
    }
  }, [messages]);

  useEffect(() => {
    if (visibleMessages.length === 0) return;

    const timers = visibleMessages.map((message) =>
      setTimeout(() => {
        setVisibleMessages((prevMessages) =>
          prevMessages.filter((msg) => msg !== message)
        );
      }, 10000)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [visibleMessages]);

  if (!visibleMessages || visibleMessages.length === 0) return null;

  return (
    <div className="fixed top-2 lg:top-auto lg:bottom-10 right-1 lg:right-10 flex flex-col items-end gap-2 z-9999">
      {visibleMessages.map((message, index) => (
        <div
          key={index}
          className="flex min-h-12 w-auto items-center justify-center rounded-[20px] bg-green-500 px-5 py-2 text-[1em] font-[900] text-white"
        >
          <p>{message}</p>
        </div>
      ))}
    </div>
  );
}
