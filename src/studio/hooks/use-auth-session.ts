"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AuthMode, AuthResponse, AuthUser } from "../types";

export function useAuthSession({
  requireAuthForExport,
  setStatus,
}: {
  requireAuthForExport: boolean;
  setStatus: (message: string) => void;
}) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(requireAuthForExport);
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authVerificationUrl, setAuthVerificationUrl] = useState<string | null>(
    null,
  );
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    if (!requireAuthForExport) return;

    let cancelled = false;
    let frame = 0;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Session request failed");
        const body = (await response.json()) as AuthResponse;
        if (!cancelled) setAuthUser(body.user ?? null);
      } catch {
        if (!cancelled) setAuthUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verified") === "1") {
        setAuthMode("login");
        setAuthPanelOpen(true);
        setStatus("邮箱验证成功，请登录");
        params.delete("verified");
        const nextQuery = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
        );
      } else if (params.get("auth_error")) {
        setAuthMode("register");
        setAuthPanelOpen(true);
        setAuthMessage("验证链接已失效，请重新注册或获取新的验证邮件");
        params.delete("auth_error");
        const nextQuery = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
        );
      }
    });

    loadSession();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [requireAuthForExport, setStatus]);

  function openAuthPanel(mode: AuthMode) {
    setAuthMode(mode);
    setAuthPanelOpen(true);
    setAuthMessage("");
    setAuthVerificationUrl(null);
  }

  function requireDownloadAuth() {
    if (!requireAuthForExport) return true;
    if (authLoading) {
      setStatus("正在确认登录状态，请稍候");
      return false;
    }
    if (!authUser) {
      setAuthMode("login");
      setAuthPanelOpen(true);
      setAuthMessage("登录后才能下载 SVG、PNG 和项目文件");
      setAuthVerificationUrl(null);
      setStatus("登录后才能下载");
      return false;
    }
    return true;
  }

  async function submitAuthForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSubmitting) return;

    setAuthSubmitting(true);
    setAuthMessage("");
    setAuthVerificationUrl(null);

    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const body = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) {
        throw new Error(body.message || "账号请求失败");
      }

      if (authMode === "login") {
        setAuthUser(body.user ?? null);
        setAuthPanelOpen(false);
        setAuthPassword("");
        setStatus("已登录，可以下载");
        return;
      }

      setAuthPassword("");
      setAuthMessage(body.message || "验证邮件已发送，请完成邮箱验证后再登录");
      setAuthVerificationUrl(body.verificationUrl ?? null);
      setStatus("验证邮件已发送");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "账号请求失败");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setAuthUser(null);
      setStatus("已退出登录");
    }
  }

  return {
    authUser,
    authLoading,
    authPanelOpen,
    setAuthPanelOpen,
    authMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authMessage,
    authVerificationUrl,
    authSubmitting,
    openAuthPanel,
    requireDownloadAuth,
    submitAuthForm,
    logout,
  };
}
