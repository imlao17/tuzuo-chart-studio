"use client";

import {
  Clipboard,
  Download,
  FileUp,
  ImageDown,
  KeyRound,
  LoaderCircle,
  LockOpen,
  LogIn,
  LogOut,
  MoreHorizontal,
  Save,
  User,
} from "lucide-react";
import type { ChangeEvent, MouseEvent, RefObject } from "react";
import { safeFilename } from "../export/download";
import { isFreeExportAction, type AuthUser } from "../types";

export function ExportToolbar({
  requireAuthForExport,
  authLoading,
  authUser,
  exporting,
  dataError,
  pixelRatio,
  pngDownloadReady,
  pngDownloadObjectUrl,
  title,
  projectInputRef,
  onOpenAuth,
  onChangePassword,
  onLogout,
  onProjectFileChange,
  onSaveProject,
  onPixelRatioChange,
  onCopyPng,
  onExportSvg,
  onPngDownloadClick,
}: {
  requireAuthForExport: boolean;
  authLoading: boolean;
  authUser: AuthUser | null;
  exporting: boolean;
  dataError: string | null;
  pixelRatio: number;
  pngDownloadReady: boolean;
  pngDownloadObjectUrl?: string;
  title: string;
  projectInputRef: RefObject<HTMLInputElement | null>;
  onOpenAuth: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onProjectFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveProject: () => void;
  onPixelRatioChange: (ratio: number) => void;
  onCopyPng: () => void;
  onExportSvg: () => void;
  onPngDownloadClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const is4xLocked =
    !isFreeExportAction({ type: "png", ratio: pixelRatio }) &&
    requireAuthForExport &&
    !authUser;
  const canDownloadCurrentPng = !is4xLocked;
  const closeMenu = (element: HTMLElement) =>
    element.closest("details")?.removeAttribute("open");

  return (
    <div className="export-toolbar">
      <div className="toolbar-group auth-toolbar" aria-label="账号">
        {authLoading ? (
          <span className="auth-state">
            <LoaderCircle className="spin" size={15} />
            检查登录
          </span>
        ) : authUser ? (
          <>
            <span className="auth-email" title={authUser.email}>
              <User size={15} />
              {authUser.email}
            </span>
            <button
              type="button"
              className="icon-button toolbar-icon-button"
              onClick={onChangePassword}
              title="修改密码"
              aria-label="修改密码"
            >
              <KeyRound size={16} />
            </button>
            <button
              type="button"
              className="icon-button toolbar-icon-button"
              onClick={onLogout}
              title="退出登录"
              aria-label="退出登录"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button-secondary auth-login-button"
            onClick={onOpenAuth}
          >
            <LogIn size={16} />
            登录 / 注册
          </button>
        )}
      </div>
      <div className="toolbar-group project-toolbar" aria-label="项目">
        <button
          type="button"
          className="icon-button toolbar-icon-button"
          onClick={() => projectInputRef.current?.click()}
          title="打开图作项目"
          aria-label="打开图作项目"
        >
          <FileUp size={16} />
        </button>
        <input
          ref={projectInputRef}
          className="sr-only"
          type="file"
          accept=".tuzuo.json,.json,application/json"
          onChange={onProjectFileChange}
        />
        <button
          type="button"
          className="icon-button toolbar-icon-button"
          onClick={onSaveProject}
          title="保存图作项目 (.tuzuo.json)"
          aria-label="保存图作项目"
        >
          <Save size={16} />
        </button>
      </div>
      <div className="toolbar-group export-actions" aria-label="导出">
        <button
          type="button"
          className="icon-button copy-action"
          onClick={onCopyPng}
          title="复制 PNG 到剪贴板"
          aria-label="复制 PNG 到剪贴板"
          disabled={exporting || Boolean(dataError)}
          aria-hidden={Boolean(dataError)}
        >
          <Clipboard size={17} />
        </button>
        <button
          type="button"
          className="button button-secondary svg-action"
          onClick={onExportSvg}
          disabled={Boolean(dataError)}
          aria-hidden={Boolean(dataError)}
          title="下载 SVG（矢量无损）"
        >
          <Download size={17} />
          SVG
        </button>
        <a
          className="button button-primary"
          href={
            canDownloadCurrentPng && pngDownloadReady
              ? pngDownloadObjectUrl
              : undefined
          }
          download={`${safeFilename(title)}@${pixelRatio}x.png`}
          aria-disabled={!pngDownloadReady}
          title={
            is4xLocked ? "4x 超高清导出需登录（免费）" : "下载 PNG"
          }
          onClick={onPngDownloadClick}
        >
          {!pngDownloadReady ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ImageDown size={17} />
          )}
          PNG
        </a>
        <details className="export-menu">
          <summary className="icon-button" aria-label="更多导出与项目操作" title="更多操作">
            <MoreHorizontal size={17} />
          </summary>
          <div className="export-menu-popover">
            {!requireAuthForExport ? (
              <div className="export-menu-state">
                <LockOpen size={14} />
                本地模式可直接导出
              </div>
            ) : authLoading ? (
              <div className="export-menu-state">
                <LoaderCircle className="spin" size={14} />
                检查登录
              </div>
            ) : authUser ? (
              <>
                <div className="export-menu-state" title={authUser.email}>
                  <User size={14} />
                  <span>{authUser.email}</span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    onLogout();
                    closeMenu(event.currentTarget);
                  }}
                >
                  <LogOut size={15} />
                  退出登录
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  onOpenAuth();
                  closeMenu(event.currentTarget);
                }}
              >
                <LogIn size={15} />
                登录 / 注册
              </button>
            )}
            <span className="export-menu-label">PNG 倍率</span>
            <div className="ratio-control" aria-label="PNG 导出倍率">
              {[1, 2, 4].map((ratio) => {
                const isLocked =
                  !isFreeExportAction({ type: "png", ratio }) &&
                  requireAuthForExport &&
                  !authUser;
                return (
                  <button
                    key={ratio}
                    type="button"
                    className={pixelRatio === ratio ? "active" : ""}
                    onClick={() => onPixelRatioChange(ratio)}
                    aria-pressed={pixelRatio === ratio}
                    title={
                      isLocked
                        ? "4x 印刷级超高清（登录后免费解锁）"
                        : `${ratio}× 倍率`
                    }
                  >
                    {ratio}×{isLocked ? " 🔒" : ""}
                  </button>
                );
              })}
            </div>
            <div className="export-menu-divider" />
            <button
              type="button"
              onClick={(event) => {
                projectInputRef.current?.click();
                closeMenu(event.currentTarget);
              }}
            >
              <FileUp size={15} />
              打开项目
            </button>
            <button
              type="button"
              onClick={(event) => {
                onSaveProject();
                closeMenu(event.currentTarget);
              }}
            >
              <Save size={15} />
              保存项目
            </button>
            <button
              type="button"
              disabled={exporting || Boolean(dataError)}
              onClick={(event) => {
                onCopyPng();
                closeMenu(event.currentTarget);
              }}
            >
              <Clipboard size={15} />
              复制 PNG
            </button>
            <button
              type="button"
              disabled={Boolean(dataError)}
              onClick={(event) => {
                onExportSvg();
                closeMenu(event.currentTarget);
              }}
            >
              <Download size={15} />
              下载 SVG
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
