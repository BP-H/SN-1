import { ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; children: ReactNode; title?: string };

export default function Modal({ open, onClose, children, title }: Props) {
  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {title && <h3 style={{ margin: "0 0 12px 0" }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
