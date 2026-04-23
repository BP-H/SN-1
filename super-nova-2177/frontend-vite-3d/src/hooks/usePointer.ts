import { useEffect, useRef } from "react";

export interface PointerHandlers {
  onMove?: (e: PointerEvent) => void;
  onUp?: (e: PointerEvent) => void;
  onCancel?: (e: PointerEvent) => void;
}

export default function usePointer(
  active: boolean,
  handlers: PointerHandlers
) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!active) return;

    const handleMove = (e: PointerEvent) => handlersRef.current.onMove?.(e);
    const handleUp = (e: PointerEvent) => handlersRef.current.onUp?.(e);
    const handleCancel = (e: PointerEvent) => {
      if (handlersRef.current.onCancel) {
        handlersRef.current.onCancel(e);
      } else {
        handlersRef.current.onUp?.(e);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [active]);
}
