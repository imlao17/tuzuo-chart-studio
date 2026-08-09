"use client";

import type { ECharts } from "echarts";
import { useEffect, useState } from "react";
import { renderPngDataUrl } from "../export/download";

type PngDownload = {
  option: Parameters<ECharts["setOption"]>[0];
  pixelRatio: number;
  objectUrl: string;
  blob: Blob;
};

export function usePngExport({
  option,
  width,
  height,
  pixelRatio,
  transparent,
  backgroundColor,
  dataError,
  requireDownloadAuth,
  setStatus,
}: {
  option: Parameters<ECharts["setOption"]>[0];
  width: number;
  height: number;
  pixelRatio: number;
  transparent: boolean;
  backgroundColor: string;
  dataError: string | null;
  requireDownloadAuth: () => boolean;
  setStatus: (message: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [pngDownload, setPngDownload] = useState<PngDownload | null>(null);

  const pngDownloadReady =
    !dataError &&
    pngDownload?.option === option &&
    pngDownload.pixelRatio === pixelRatio;

  useEffect(() => {
    // While data validation fails there is no valid chart to export: skip PNG
    // generation entirely. pngDownloadReady already factors in dataError, so
    // the export buttons show their not-ready state without clearing stale
    // state that may still be referenced by an in-flight click.
    if (dataError) return;
    let objectUrl = "";
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const dataUrl = await renderPngDataUrl({
          option,
          width,
          height,
          pixelRatio,
          transparent,
          backgroundColor,
        });
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        if (!blob.size) throw new Error("PNG 生成失败");
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPngDownload({
          option,
          pixelRatio,
          objectUrl,
          blob,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("PNG preparation failed", error);
        setPngDownload(null);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    backgroundColor,
    dataError,
    height,
    option,
    pixelRatio,
    transparent,
    width,
  ]);

  async function copyPng() {
    if (!requireDownloadAuth()) return;
    setExporting(true);
    try {
      const blob =
        pngDownloadReady && pngDownload
          ? pngDownload.blob
          : await fetch(
              await renderPngDataUrl({
                option,
                width,
                height,
                pixelRatio,
                transparent,
                backgroundColor,
              }),
            ).then((response) => response.blob());
      if (!blob.size) throw new Error("PNG 生成失败");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("PNG 已复制");
    } catch {
      setStatus("当前浏览器不支持复制图片");
    } finally {
      setExporting(false);
    }
  }

  return {
    pngDownload,
    pngDownloadReady,
    exporting,
    copyPng,
  };
}
