"use client";

import { LoaderCircle, Mail, X } from "lucide-react";
import type { FormEvent } from "react";
import type { AuthMode } from "../types";
import { useDialogFocus } from "../hooks/use-dialog-focus";

export function AuthDialog({
  mode,
  email,
  password,
  message,
  verificationUrl,
  submitting,
  onClose,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  mode: AuthMode;
  email: string;
  password: string;
  message: string;
  verificationUrl: string | null;
  submitting: boolean;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>({ open: true, onClose });

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        tabIndex={-1}
      >
        <div className="auth-dialog-header">
          <div className="auth-title-block">
            <span className="auth-title-icon" aria-hidden="true">
              <Mail size={16} />
            </span>
            <div>
              <h2 id="auth-dialog-title">
                {mode === "login" ? "登录图作账号" : "注册图作账号"}
              </h2>
              <p>登录后可下载 SVG、PNG 和项目文件</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="关闭账号面板"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="账号操作">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => onModeChange("login")}
            role="tab"
            aria-selected={mode === "login"}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => onModeChange("register")}
            role="tab"
            aria-selected={mode === "register"}
          >
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>

          {mode === "register" && (
            <p className="auth-note">注册后需要完成邮箱验证，再登录下载。</p>
          )}

          {message && (
            <div className="auth-message" role="status">
              <span>{message}</span>
              {verificationUrl && (
                <a href={verificationUrl} target="_blank" rel="noreferrer">
                  打开验证链接
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            className="button button-primary auth-submit-button"
            disabled={submitting}
          >
            {submitting && <LoaderCircle className="spin" size={16} />}
            {mode === "login" ? "登录" : "发送验证邮件"}
          </button>
        </form>
      </section>
    </div>
  );
}
