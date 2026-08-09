import type { ECharts } from "echarts";

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.requestAnimationFrame(() => link.remove());
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "图表"
  );
}

export async function renderPngDataUrl({
  option,
  width,
  height,
  pixelRatio,
  transparent,
  backgroundColor,
}: {
  option: Parameters<ECharts["setOption"]>[0];
  width: number;
  height: number;
  pixelRatio: number;
  transparent: boolean;
  backgroundColor: string;
}) {
  const exportHost = document.createElement("div");
  exportHost.style.position = "fixed";
  exportHost.style.left = "-100000px";
  exportHost.style.top = "0";
  exportHost.style.width = `${width}px`;
  exportHost.style.height = `${height}px`;
  exportHost.style.pointerEvents = "none";
  exportHost.setAttribute("aria-hidden", "true");
  document.body.appendChild(exportHost);

  const { init } = await import("echarts");
  const exportChart = init(exportHost, undefined, {
    renderer: "canvas",
    width,
    height,
    devicePixelRatio: 1,
  });

  try {
    exportChart.setOption(
      {
        ...option,
        animation: false,
        backgroundColor: transparent ? "rgba(0,0,0,0)" : backgroundColor,
      },
      true,
    );
    return exportChart.getDataURL({
      type: "png",
      pixelRatio,
      backgroundColor: transparent ? undefined : backgroundColor,
    });
  } finally {
    exportChart.dispose();
    exportHost.remove();
  }
}
