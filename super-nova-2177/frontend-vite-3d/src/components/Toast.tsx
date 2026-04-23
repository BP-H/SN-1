import { useEffect, useRef, useId } from "react";

export type ToastProps = {
  message: string;
  onClose: () => void;
};

export default function Toast({ message, onClose }: ToastProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const messageId = useId();

  useEffect(() => {
    lastFocused.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-describedby={messageId}
      className="toast-overlay"
      onClick={onClose}
    >
      <div className="toast" onClick={(e) => e.stopPropagation()}>
        <p id={messageId}>{message}</p>
        <button ref={closeRef} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
