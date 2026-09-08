"use client";

import { AlertTriangle, X } from "lucide-react";
import { useDialogFocus } from "../hooks/use-dialog-focus";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  variant = "danger",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>({ open, onClose: onCancel });
  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
      >
        <div className="confirm-dialog-header">
          <span className="confirm-dialog-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <h2 id="confirm-dialog-title">{title}</h2>
          <button
            type="button"
            className="dialog-close-button"
            onClick={onCancel}
            aria-label="关闭确认窗口"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <p id="confirm-dialog-description">{description}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="button button-secondary" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={`button ${variant === "primary" ? "button-primary" : "button-danger"}`}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
