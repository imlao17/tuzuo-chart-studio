"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  isFreeExportAction,
  type AuthMode,
  type AuthResponse,
  type AuthUser,
  type ExportAction,
} from "../types";

export function useAuthSession({
  requireAuthForExport,
  setStatus,
}: {
  requireAuthForExport: boolean;
  setStatus: (message: string) => void;
}) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  // The session is always loaded: cloud projects need the signed-in user even
  // when the export gate is off.
  const [authLoading, setAuthLoading] = useState(true);
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authCurrentPassword, setAuthCurrentPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authVerificationUrl, setAuthVerificationUrl] = useState<string | null>(
    null,
  );
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (!response.ok) return;
        const body = (await response.json().catch(() => ({}))) as AuthResponse;
        if (!cancelled && body.user) {
          setAuthUser(body.user);
        }
      } catch {
        // Leave the user unauthenticated on network error.
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    // setTimeout instead of rAF: a throttled frame queue (backgrounded pane)
    // pauses rAF entirely and the ?verified / ?reset / ?auth_error handling
    // would never run; timers only slow down, so they always fire.
    const frame = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verified") === "1") {
        setAuthMode("login");
        setAuthPanelOpen(true);
        setAuthMessage("邮箱已验证，请登录");
        params.delete("verified");
        const nextQuery = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
        );
      } else if (params.get("reset") === "1") {
        setAuthMode("login");
        setAuthPanelOpen(true);
        setAuthMessage("密码已重置，请使用新密码登录");
        params.delete("reset");
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
    }, 0);

    loadSession();
    return () => {
      cancelled = true;
      window.clearTimeout(frame);
    };
  }, [requireAuthForExport, setStatus]);

  function openAuthPanel(mode: AuthMode) {
    setAuthMode(mode);
    setAuthPanelOpen(true);
    setAuthMessage("");
    setAuthVerificationUrl(null);
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthCurrentPassword("");
  }

  function openChangePassword() {
    setAuthMode("change");
    setAuthPanelOpen(true);
    setAuthMessage("");
    setAuthVerificationUrl(null);
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthCurrentPassword("");
  }

  function requireDownloadAuth(action?: ExportAction) {
    if (!requireAuthForExport) return true;
    if (isFreeExportAction(action)) {
      return true;
    }
    if (authLoading) {
      setStatus("正在检查登录状态…");
      return false;
    }
    if (action?.type === "png" && action.ratio >= 4 && !authUser) {
      openAuthPanel("login");
      setStatus("4x 超高清导出需要登录账号（免费）");
      setAuthMessage("登录后免费解锁 4x 印刷级超高清导出");
      return false;
    }
    if (!authUser) {
      openAuthPanel("login");
      setStatus("登录后才能下载或导出图表");
      return false;
    }
    return true;
  }

  async function submitAuthForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSubmitting) return;

    setAuthMessage("");
    setAuthVerificationUrl(null);

    if (
      (authMode === "register" || authMode === "change") &&
      authPassword !== authConfirmPassword
    ) {
      setAuthMessage("两次输入的密码不一致");
      return;
    }
    if (authMode === "change" && authCurrentPassword === authPassword) {
      setAuthMessage("新密码不能与当前密码相同");
      return;
    }

    setAuthSubmitting(true);

    const endpoints: Record<AuthMode, { url: string; body: unknown }> = {
      login: {
        url: "/api/auth/login",
        body: { email: authEmail, password: authPassword },
      },
      register: {
        url: "/api/auth/register",
        body: { email: authEmail, password: authPassword },
      },
      forgot: {
        url: "/api/auth/forgot-password",
        body: { email: authEmail },
      },
      change: {
        url: "/api/auth/change-password",
        body: { currentPassword: authCurrentPassword, newPassword: authPassword },
      },
    };
    const endpoint = endpoints[authMode];

    if (
      (authMode === "register" || authMode === "change") &&
      authConfirmPassword !== authPassword
    ) {
      setAuthMessage("两次输入的密码不一致");
      return;
    }

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(endpoint.body),
      });
      const body = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) {
        throw new Error(body.message || "账号请求失败");
      }

      if (authMode === "login") {
        setAuthUser(body.user ?? null);
        setAuthPanelOpen(false);
        setAuthPassword("");
        setAuthConfirmPassword("");
        setStatus("已登录");
        return;
      }
      if (authMode === "change") {
        setAuthPanelOpen(false);
        setAuthPassword("");
        setAuthConfirmPassword("");
        setAuthCurrentPassword("");
        setStatus("密码已修改，其他设备会话已失效");
        return;
      }
      if (authMode === "forgot") {
        setAuthPassword("");
        setAuthConfirmPassword("");
        setAuthMessage(body.message || "如果该邮箱已注册，重置邮件已发送，请查收");
        setAuthVerificationUrl(body.resetUrl ?? null);
        setStatus("重置邮件已发送");
        return;
      }

      setAuthPassword("");
      setAuthConfirmPassword("");
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
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthCurrentPassword("");
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
    authConfirmPassword,
    setAuthConfirmPassword,
    authMessage,
    authVerificationUrl,
    authSubmitting,
    authCurrentPassword,
    setAuthCurrentPassword,
    openAuthPanel,
    openChangePassword,
    requireDownloadAuth,
    submitAuthForm,
    logout,
  };
}
