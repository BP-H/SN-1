// src/components/AvatarPortal.tsx
import React, { useEffect, useRef, useState } from "react";
import bus from "../lib/bus";
import "./AvatarPortal.css";

export default function AvatarPortal(){
  const [on, setOn] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = bus.on("avatar-portal:open", () => {
      setOn(true);
      timeoutRef.current = setTimeout(() => setOn(false), 900);
    });

    return () => {
      off();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  return on ? (
    <div className="avatar-portal">
      <div className="ap-splash" />
      <div className="ap-ring" />
    </div>
  ) : null;
}
