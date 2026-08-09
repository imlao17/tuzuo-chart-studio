"use client";

import {
  Clipboard,
  Download,
  FileUp,
  ImageDown,
  LoaderCircle,
  LockOpen,
  LogIn,
  LogOut,
  Save,
  User,
} from "lucide-react";
import type { ChangeEvent, MouseEvent, RefObject } from "react";
import { safeFilename } from "../export/download";
import type { AuthUser } from "../types";

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
  onLogout: () => void;
  onProjectFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveProject: () => void;
  onPixelRatioChange: (ratio: number) => void;
  onCopyPng: () => void;
  onExportSvg: () => void;
  onPngDownloadClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const canExport = !requireAuthForExport || Boolean(authUser);

  return (
    <div className="export-toolbar">
      <div className="toolbar-group auth-toolbar" aria-label="账号">
        {!requireAuthForExport ? (
          <span className="auth-state" title="本地模式可直接导出">
            <LockOpen size={15} />
            本地模式
          </span>
        ) : authLoading ? (
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
          title="保存图作项目"
          aria-label="保存图作项目"
        >
          <Save size={16} />
        </button>
      </div>
      <div className="toolbar-group ratio-toolbar">
        <span className="toolbar-label">倍率</span>
        <div className="ratio-control" aria-label="PNG 导出倍率">
          {[1, 2, 4].map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={pixelRatio === ratio ? "active" : ""}
              onClick={() => onPixelRatioChange(ratio)}
              aria-pressed={pixelRatio === ratio}
            >
              {ratio}×
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar-group export-actions" aria-label="导出">
        <button
          type="button"
          className="icon-button"
          onClick={onCopyPng}
          title={canExport ? "复制 PNG" : "登录后复制 PNG"}
          aria-label={canExport ? "复制 PNG" : "登录后复制 PNG"}
          disabled={exporting || Boolean(dataError)}
          aria-hidden={Boolean(dataError)}
        >
          <Clipboard size={17} />
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onExportSvg}
          disabled={Boolean(dataError)}
          aria-hidden={Boolean(dataError)}
          title={canExport ? "下载 SVG" : "登录后下载 SVG"}
        >
          <Download size={17} />
          SVG
        </button>
        <a
          className="button button-primary"
          href={canExport && pngDownloadReady ? pngDownloadObjectUrl : undefined}
          download={`${safeFilename(title)}@${pixelRatio}x.png`}
          aria-disabled={
            (requireAuthForExport && (!authUser || authLoading)) ||
            !pngDownloadReady
          }
          title={canExport ? "下载 PNG" : "登录后下载 PNG"}
          onClick={onPngDownloadClick}
        >
          {!pngDownloadReady ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ImageDown size={17} />
          )}
          PNG
        </a>
      </div>
    </div>
  );
}
