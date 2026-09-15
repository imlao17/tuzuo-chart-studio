"use client";

import { LoaderCircle, Mail, X } from "lucide-react";
import type { FormEvent } from "react";
import type { AuthMode } from "../types";
import { useDialogFocus } from "../hooks/use-dialog-focus";

export function AuthDialog({
  mode,
  email,
  password,
  confirmPassword,
  currentPassword,
  message,
  verificationUrl,
  submitting,
  onClose,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onSubmit,
}: {
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  currentPassword: string;
  message: string;
  verificationUrl: string | null;
  submitting: boolean;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onCurrentPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isMainMode = mode === "login" || mode === "register";
  const titleByMode: Record<AuthMode, string> = {
    login: "登录知图账号",
    register: "注册知图账号",
    forgot: "重置密码",
    change: "修改密码",
  };
  const submitLabelByMode: Record<AuthMode, string> = {
    login: "登录",
    register: "发送验证邮件",
    forgot: "发送重置邮件",
    change: "修改密码",
  };
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
              <h2 id="auth-dialog-title">{titleByMode[mode]}</h2>
              <p>
                {mode === "forgot"
                  ? "输入注册邮箱，我们会发送重置链接"
                  : mode === "change"
                    ? "修改后其他设备需要重新登录"
                    : mode === "register"
                      ? "免费注册知图账号，享受超高清导出与云端保存"
                      : "登录后解锁 4x 印刷级超高清导出与云端工程同步"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dialog-close-button"
            onClick={onClose}
            aria-label="关闭账号面板"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {isMainMode ? (
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
        ) : (
          <button
            type="button"
            className="auth-back-link"
            onClick={() => onModeChange("login")}
          >
            ← 返回登录
          </button>
        )}

        <form className="auth-form" onSubmit={onSubmit}>
          {mode !== "change" && (
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
          )}
          {mode === "change" && (
            <label className="field">
              <span>当前密码</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => onCurrentPasswordChange(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              <span>{mode === "change" ? "新密码" : "密码"}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>
          )}
          {(mode === "register" || mode === "change") && (
            <label className="field">
              <span>{mode === "change" ? "确认新密码" : "确认密码"}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                autoComplete="new-password"
                placeholder={mode === "change" ? "再次输入新密码" : "再次输入密码"}
                minLength={8}
                required
              />
            </label>
          )}

          {mode === "register" && (
            <p className="auth-note">注册后需要完成邮箱验证，再登录下载。</p>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="auth-back-link"
              onClick={() => onModeChange("forgot")}
            >
              忘记密码？
            </button>
          )}

          {message && (
            <div className="auth-message" role="status">
              <span>{message}</span>
              {verificationUrl && (
                <a href={verificationUrl} target="_blank" rel="noreferrer">
                  {mode === "forgot" ? "打开重置链接" : "打开验证链接"}
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
            {submitLabelByMode[mode]}
          </button>
        </form>
      </section>
    </div>
  );
}
