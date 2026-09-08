"use client";

import { LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

/**
 * Password-reset landing page: the reset email links here with ?token=…,
 * the user picks a new password, and success bounces back to the editor
 * with ?reset=1 so the auth panel opens on the login tab.
 */
export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // setTimeout instead of rAF: a throttled frame queue (backgrounded pane)
    // pauses rAF entirely, leaving the token empty and the form unusable.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setToken(params.get("token") ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(body.message || "重置失败，请重试");
      }
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重置失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="reset-page">
      <section className="auth-dialog reset-dialog" aria-labelledby="reset-title">
        <div className="auth-dialog-header">
          <div className="auth-title-block">
            <span className="auth-title-icon" aria-hidden="true">
              {done ? <ShieldCheck size={16} /> : <Mail size={16} />}
            </span>
            <div>
              <h2 id="reset-title">{done ? "密码已重置" : "重置图作密码"}</h2>
              <p>
                {done
                  ? "请返回图作使用新密码登录"
                  : "设置新密码后，所有设备需要重新登录"}
              </p>
            </div>
          </div>
        </div>

        {done ? (
          <div className="auth-form reset-done">
            <Link className="button button-primary" href="/?reset=1">
              返回图作登录
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>新密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>确认新密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            {!token && (
              <p className="auth-note">缺少重置令牌，请从邮件中的链接进入。</p>
            )}
            {error && (
              <div className="auth-message" role="alert">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="button button-primary auth-submit-button"
              disabled={submitting || !token}
            >
              {submitting && <LoaderCircle className="spin" size={16} />}
              重置密码
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
