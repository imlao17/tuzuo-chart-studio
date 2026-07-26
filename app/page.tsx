"use client";

import type { ECharts, EChartsOption, SeriesOption } from "echarts";
import {
  AreaChart,
  BarChart3,
  Check,
  Clipboard,
  Download,
  FileUp,
  ImageDown,
  LineChart,
  LoaderCircle,
  PieChart,
  RefreshCcw,
  ScatterChart,
  Settings2,
  Table2,
} from "lucide-react";
import {
  ChangeEvent,
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ChartType =
  | "bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "pie"
  | "scatter";

type ParsedData = {
  headers: string[];
  rows: string[][];
  numericHeaders: string[];
  delimiter: "," | "\t";
  error?: string;
};

type ThemePreset = {
  id: string;
  name: string;
  colors: string[];
  text: string;
  grid: string;
};

type SavedState = {
  rawData: string;
  chartType: ChartType;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  xColumn: string;
  yColumn: string;
  y2Column: string;
  themeId: string;
  primaryColor: string;
  secondaryColor: string;
  transparent: boolean;
  showLabels: boolean;
  showLegend: boolean;
  showGrid: boolean;
  smooth: boolean;
  fontSize: number;
  pixelRatio: number;
};

const INITIAL_DATA = `月份\t实际收入\t目标
一月\t128\t110
二月\t146\t125
三月\t138\t140
四月\t172\t150
五月\t189\t165
六月\t218\t190`;

const THEMES: ThemePreset[] = [
  {
    id: "editorial",
    name: "编辑蓝",
    colors: ["#2563eb", "#f15a3a", "#16a36a", "#e8ae17"],
    text: "#17202a",
    grid: "#dfe3e8",
  },
  {
    id: "fresh",
    name: "清新",
    colors: ["#0f8b8d", "#ff7a45", "#4c78df", "#f2b134"],
    text: "#163331",
    grid: "#dce7e5",
  },
  {
    id: "magazine",
    name: "杂志",
    colors: ["#171717", "#e5484d", "#168aad", "#f4a261"],
    text: "#171717",
    grid: "#dedede",
  },
  {
    id: "soft",
    name: "柔和",
    colors: ["#6577c9", "#e07a5f", "#5a9367", "#e9b44c"],
    text: "#30343b",
    grid: "#e1e2e5",
  },
  {
    id: "mono",
    name: "黑白",
    colors: ["#222222", "#777777", "#a7a7a7", "#d0d0d0"],
    text: "#191919",
    grid: "#dedede",
  },
];

const CHART_TYPES: {
  id: ChartType;
  label: string;
  icon: typeof BarChart3;
}[] = [
  { id: "bar", label: "柱状", icon: BarChart3 },
  { id: "horizontalBar", label: "条形", icon: BarChart3 },
  { id: "line", label: "折线", icon: LineChart },
  { id: "area", label: "面积", icon: AreaChart },
  { id: "pie", label: "环形", icon: PieChart },
  { id: "scatter", label: "散点", icon: ScatterChart },
];

const DEFAULT_STATE: SavedState = {
  rawData: INITIAL_DATA,
  chartType: "bar",
  title: "上半年收入趋势",
  subtitle: "单位：万元",
  width: 960,
  height: 540,
  xColumn: "月份",
  yColumn: "实际收入",
  y2Column: "目标",
  themeId: "editorial",
  primaryColor: THEMES[0].colors[0],
  secondaryColor: THEMES[0].colors[1],
  transparent: true,
  showLabels: true,
  showLegend: true,
  showGrid: true,
  smooth: true,
  fontSize: 14,
  pixelRatio: 2,
};

function countDelimiter(line: string, delimiter: "," | "\t") {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (!quoted && line[index] === delimiter) count += 1;
  }

  return count;
}

function parseDelimited(raw: string): ParsedData {
  const input = raw.replace(/^\uFEFF/, "").trim();
  const firstLine = input.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const delimiter: "," | "\t" =
    countDelimiter(firstLine, "\t") > countDelimiter(firstLine, ",")
      ? "\t"
      : ",";

  if (!input) {
    return {
      headers: [],
      rows: [],
      numericHeaders: [],
      delimiter,
      error: "请粘贴或上传数据",
    };
  }

  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let quoted = false;

  for (let index = 0; index <= input.length; index += 1) {
    const character = input[index] ?? "\n";
    const nextCharacter = input[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && character === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      currentRow.push(currentCell.trim());
      currentCell = "";

      if (currentRow.some((cell) => cell !== "")) parsedRows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (parsedRows.length < 2) {
    return {
      headers: parsedRows[0] ?? [],
      rows: [],
      numericHeaders: [],
      delimiter,
      error: "至少需要一行标题和一行数据",
    };
  }

  const columnCount = Math.max(...parsedRows.map((row) => row.length));
  const headers = Array.from({ length: columnCount }, (_, index) => {
    return parsedRows[0][index]?.trim() || `列 ${index + 1}`;
  });
  const rows = parsedRows.slice(1).map((row) => {
    return Array.from({ length: columnCount }, (_, index) => row[index] ?? "");
  });
  const numericHeaders = headers.filter((_, columnIndex) => {
    const populated = rows
      .map((row) => row[columnIndex])
      .filter((value) => value !== "");

    if (!populated.length) return false;

    return (
      populated.filter((value) => Number.isFinite(toNumber(value))).length /
        populated.length >=
      0.7
    );
  });

  return { headers, rows, numericHeaders, delimiter };
}

function toNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/[￥¥$,\s]/g, "")
    .replace(/%$/, "");
  const negative =
    normalized.startsWith("(") && normalized.endsWith(")")
      ? `-${normalized.slice(1, -1)}`
      : normalized;
  const number = Number(negative);
  return Number.isFinite(number) ? number : Number.NaN;
}

function columnIndex(headers: string[], name: string) {
  return Math.max(0, headers.indexOf(name));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function svgDataUrlToBlob(dataUrl: string) {
  const content = decodeURIComponent(dataUrl.split(",")[1] ?? "");
  return new Blob([content], { type: "image/svg+xml;charset=utf-8" });
}

async function svgToPngBlob(
  svgDataUrl: string,
  width: number,
  height: number,
  pixelRatio: number,
  background: string | null,
) {
  const image = new Image();
  image.decoding = "sync";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("图片转换失败"));
    image.src = svgDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("无法创建图片画布");

  context.scale(pixelRatio, pixelRatio);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 生成失败"));
    }, "image/png");
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(blob);
  });
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

export default function Home() {
  const [rawData, setRawData] = useState(DEFAULT_STATE.rawData);
  const [chartType, setChartType] = useState<ChartType>(
    DEFAULT_STATE.chartType,
  );
  const [title, setTitle] = useState(DEFAULT_STATE.title);
  const [subtitle, setSubtitle] = useState(DEFAULT_STATE.subtitle);
  const [width, setWidth] = useState(DEFAULT_STATE.width);
  const [height, setHeight] = useState(DEFAULT_STATE.height);
  const [xColumn, setXColumn] = useState(DEFAULT_STATE.xColumn);
  const [yColumn, setYColumn] = useState(DEFAULT_STATE.yColumn);
  const [y2Column, setY2Column] = useState(DEFAULT_STATE.y2Column);
  const [themeId, setThemeId] = useState(DEFAULT_STATE.themeId);
  const [primaryColor, setPrimaryColor] = useState(
    DEFAULT_STATE.primaryColor,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    DEFAULT_STATE.secondaryColor,
  );
  const [transparent, setTransparent] = useState(DEFAULT_STATE.transparent);
  const [showLabels, setShowLabels] = useState(DEFAULT_STATE.showLabels);
  const [showLegend, setShowLegend] = useState(DEFAULT_STATE.showLegend);
  const [showGrid, setShowGrid] = useState(DEFAULT_STATE.showGrid);
  const [smooth, setSmooth] = useState(DEFAULT_STATE.smooth);
  const [fontSize, setFontSize] = useState(DEFAULT_STATE.fontSize);
  const [pixelRatio, setPixelRatio] = useState(DEFAULT_STATE.pixelRatio);
  const [previewScale, setPreviewScale] = useState(1);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseDelimited(rawData), [rawData]);
  const theme =
    THEMES.find((candidate) => candidate.id === themeId) ?? THEMES[0];
  const isCartesian = chartType !== "pie";
  const canSmooth = chartType === "line" || chartType === "area";
  const selectedXColumn = parsed.headers.includes(xColumn)
    ? xColumn
    : parsed.headers.find(
        (header) => !parsed.numericHeaders.includes(header),
      ) ?? parsed.headers[0] ?? "";
  const selectedYColumn = parsed.headers.includes(yColumn)
    ? yColumn
    : parsed.numericHeaders[0] ?? parsed.headers[1] ?? "";
  const selectedY2Column =
    y2Column && parsed.headers.includes(y2Column) ? y2Column : "";

  const option = useMemo<EChartsOption>(() => {
    const xIndex = columnIndex(parsed.headers, selectedXColumn);
    const yIndex = columnIndex(parsed.headers, selectedYColumn);
    const y2Index = columnIndex(parsed.headers, selectedY2Column);
    const categories = parsed.rows.map((row) => row[xIndex]);
    const primaryValues = parsed.rows.map((row) => toNumber(row[yIndex]));
    const secondaryValues = parsed.rows.map((row) =>
      selectedY2Column ? toNumber(row[y2Index]) : Number.NaN,
    );
    const titleTop = subtitle ? 24 : 32;
    const gridTop = title || subtitle ? 104 : 48;
    const labelColor = theme.text;
    const axisLine = { lineStyle: { color: "#aeb6bf" } };
    const splitLine = {
      show: showGrid,
      lineStyle: { color: theme.grid, type: "dashed" as const },
    };
    const axisLabel = {
      color: labelColor,
      fontSize,
      hideOverlap: true,
    };
    let series: SeriesOption[] = [];

    if (chartType === "pie") {
      series = [
        {
          name: selectedYColumn,
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "57%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: transparent ? "rgba(255,255,255,0.82)" : "#ffffff",
            borderWidth: 2,
            borderRadius: 4,
          },
          label: {
            show: showLabels,
            color: labelColor,
            fontSize,
            formatter: "{b}\n{d}%",
            lineHeight: fontSize + 6,
          },
          emphasis: { scaleSize: 8 },
          data: categories.map((name, index) => ({
            name,
            value: primaryValues[index],
          })),
        },
      ];
    } else if (chartType === "scatter") {
      const scatterLabelIndex = parsed.headers.findIndex(
        (header) => !parsed.numericHeaders.includes(header),
      );
      series = [
        {
          name: selectedYColumn,
          type: "scatter",
          symbolSize: (value: unknown) => {
            const pair = value as number[];
            return Math.max(10, Math.min(26, 10 + Math.abs(pair[1]) / 20));
          },
          itemStyle: {
            color: primaryColor,
            opacity: 0.84,
          },
          label: {
            show: showLabels,
            position: "top",
            color: labelColor,
            fontSize,
            formatter: (params: unknown) => {
              const item = params as { dataIndex: number };
              return scatterLabelIndex >= 0
                ? parsed.rows[item.dataIndex][scatterLabelIndex]
                : "";
            },
          },
          data: parsed.rows.map((row) => [
            toNumber(row[xIndex]),
            toNumber(row[yIndex]),
          ]),
        },
      ];
    } else {
      const seriesType = chartType === "bar" || chartType === "horizontalBar"
        ? "bar"
        : "line";
      const baseSeries = {
        type: seriesType,
        barMaxWidth: 48,
        smooth: canSmooth && smooth,
        symbol: "circle",
        symbolSize: 7,
        label: {
          show: showLabels,
          position: (chartType === "horizontalBar" ? "right" : "top") as
            | "right"
            | "top",
          color: labelColor,
          fontSize,
        },
        emphasis: { focus: "series" as const },
      };

      series = [
        {
          ...baseSeries,
          name: selectedYColumn,
          data: primaryValues,
          itemStyle: {
            color: primaryColor,
            borderRadius:
              seriesType === "bar"
                ? chartType === "horizontalBar"
                  ? [0, 4, 4, 0]
                  : [4, 4, 0, 0]
                : 0,
          },
          lineStyle: { color: primaryColor, width: 3 },
          areaStyle:
            chartType === "area"
              ? { color: primaryColor, opacity: 0.18 }
              : undefined,
        },
      ];

      if (selectedY2Column) {
        series.push({
          ...baseSeries,
          name: selectedY2Column,
          data: secondaryValues,
          itemStyle: {
            color: secondaryColor,
            borderRadius:
              seriesType === "bar"
                ? chartType === "horizontalBar"
                  ? [0, 4, 4, 0]
                  : [4, 4, 0, 0]
                : 0,
          },
          lineStyle: { color: secondaryColor, width: 3 },
          areaStyle:
            chartType === "area"
              ? { color: secondaryColor, opacity: 0.12 }
              : undefined,
        });
      }
    }

    const categoryAxis = {
      type: "category" as const,
      data: categories,
      axisLine,
      axisTick: { show: false },
      axisLabel,
    };
    const valueAxis = {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
      splitLine,
    };

    return {
      animation: true,
      animationDuration: 520,
      animationEasing: "cubicOut",
      backgroundColor: transparent ? "transparent" : "#ffffff",
      color: [primaryColor, secondaryColor, ...theme.colors.slice(2)],
      textStyle: {
        fontFamily:
          '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        color: labelColor,
      },
      title: {
        show: Boolean(title || subtitle),
        left: 32,
        top: titleTop,
        text: title,
        subtext: subtitle,
        itemGap: 8,
        textStyle: {
          color: labelColor,
          fontSize: Math.max(22, fontSize + 10),
          fontWeight: 700,
        },
        subtextStyle: {
          color: "#68727d",
          fontSize: Math.max(12, fontSize - 1),
        },
      },
      legend: {
        show:
          showLegend &&
          (chartType === "pie" ||
            (Boolean(selectedY2Column) && isCartesian)),
        top: 30,
        right: 32,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: labelColor, fontSize },
      },
      tooltip: {
        trigger: chartType === "pie" ? "item" : "axis",
        backgroundColor: "rgba(24, 28, 33, 0.92)",
        borderWidth: 0,
        textStyle: { color: "#ffffff", fontSize },
        padding: [10, 12],
      },
      grid:
        chartType === "pie"
          ? undefined
          : {
              top: gridTop,
              right: showLabels ? 52 : 36,
              bottom: 48,
              left: chartType === "horizontalBar" ? 88 : 66,
              containLabel: true,
            },
      xAxis:
        chartType === "pie"
          ? undefined
          : chartType === "horizontalBar"
            ? valueAxis
            : chartType === "scatter"
              ? valueAxis
              : categoryAxis,
      yAxis:
        chartType === "pie"
          ? undefined
          : chartType === "horizontalBar"
            ? categoryAxis
            : valueAxis,
      series,
    };
  }, [
    canSmooth,
    chartType,
    fontSize,
    isCartesian,
    parsed.headers,
    parsed.numericHeaders,
    parsed.rows,
    primaryColor,
    secondaryColor,
    showGrid,
    showLabels,
    showLegend,
    smooth,
    subtitle,
    theme,
    title,
    transparent,
    selectedXColumn,
    selectedY2Column,
    selectedYColumn,
  ]);

  const initialChartStateRef = useRef({ height, option, width });

  useEffect(() => {
    let cancelled = false;

    async function mountChart() {
      if (!chartElementRef.current || chartRef.current) return;
      const echarts = await import("echarts");
      if (cancelled || !chartElementRef.current) return;
      const initial = initialChartStateRef.current;
      chartRef.current = echarts.init(chartElementRef.current, undefined, {
        renderer: "svg",
        width: initial.width,
        height: initial.height,
      });
      chartRef.current.setOption(initial.option, true);
    }

    mountChart();

    return () => {
      cancelled = true;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.resize({ width, height });
    chartRef.current?.setOption(option, true);
  }, [height, option, width]);

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host) return;

    const updateScale = () => {
      const availableWidth = Math.max(280, host.clientWidth - 48);
      const availableHeight = Math.max(260, host.clientHeight - 48);
      setPreviewScale(
        Math.min(1, availableWidth / width, availableHeight / height),
      );
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(host);
    updateScale();
    return () => observer.disconnect();
  }, [height, width]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  function selectTheme(nextTheme: ThemePreset) {
    setThemeId(nextTheme.id);
    setPrimaryColor(nextTheme.colors[0]);
    setSecondaryColor(nextTheme.colors[1]);
  }

  function selectChartType(nextType: ChartType) {
    setChartType(nextType);
    if (nextType === "scatter") {
      setXColumn(parsed.numericHeaders[0] ?? xColumn);
      setYColumn(
        parsed.numericHeaders[1] ??
          parsed.numericHeaders[0] ??
          selectedYColumn,
      );
      setY2Column("");
    } else if (chartType === "scatter") {
      setXColumn(
        parsed.headers.find(
          (header) => !parsed.numericHeaders.includes(header),
        ) ?? parsed.headers[0],
      );
      setYColumn(parsed.numericHeaders[0] ?? selectedYColumn);
      setY2Column(parsed.numericHeaders[1] ?? "");
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setRawData(text);
      setStatus(`已载入 ${file.name}`);
    } catch {
      setStatus("文件读取失败");
    } finally {
      event.target.value = "";
    }
  }

  async function createPngBlob() {
    if (!chartRef.current) throw new Error("图表尚未准备好");
    const svgDataUrl = chartRef.current.getSvgDataURL();
    return svgToPngBlob(
      svgDataUrl,
      width,
      height,
      pixelRatio,
      transparent ? null : "#ffffff",
    );
  }

  async function exportPng() {
    setExporting(true);
    try {
      const blob = await createPngBlob();
      const dataUrl = await blobToDataUrl(blob);
      downloadDataUrl(dataUrl, `${title || "图表"}@${pixelRatio}x.png`);
      setStatus("PNG 已导出");
    } catch {
      setStatus("PNG 导出失败");
    } finally {
      setExporting(false);
    }
  }

  function exportSvg() {
    if (!chartRef.current) return;
    const blob = svgDataUrlToBlob(chartRef.current.getSvgDataURL());
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${title || "图表"}.svg`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("SVG 已导出");
  }

  async function copyPng() {
    setExporting(true);
    try {
      const blob = await createPngBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("PNG 已复制");
    } catch {
      setStatus("当前浏览器不支持复制图片");
    } finally {
      setExporting(false);
    }
  }

  function resetAll() {
    setRawData(DEFAULT_STATE.rawData);
    setChartType(DEFAULT_STATE.chartType);
    setTitle(DEFAULT_STATE.title);
    setSubtitle(DEFAULT_STATE.subtitle);
    setWidth(DEFAULT_STATE.width);
    setHeight(DEFAULT_STATE.height);
    setXColumn(DEFAULT_STATE.xColumn);
    setYColumn(DEFAULT_STATE.yColumn);
    setY2Column(DEFAULT_STATE.y2Column);
    setThemeId(DEFAULT_STATE.themeId);
    setPrimaryColor(DEFAULT_STATE.primaryColor);
    setSecondaryColor(DEFAULT_STATE.secondaryColor);
    setTransparent(DEFAULT_STATE.transparent);
    setShowLabels(DEFAULT_STATE.showLabels);
    setShowLegend(DEFAULT_STATE.showLegend);
    setShowGrid(DEFAULT_STATE.showGrid);
    setSmooth(DEFAULT_STATE.smooth);
    setFontSize(DEFAULT_STATE.fontSize);
    setPixelRatio(DEFAULT_STATE.pixelRatio);
    setStatus("已恢复示例");
  }

  const previewStyle = {
    "--preview-width": `${width * previewScale}px`,
    "--preview-height": `${height * previewScale}px`,
    "--chart-width": `${width}px`,
    "--chart-height": `${height}px`,
    "--preview-scale": previewScale,
  } as CSSProperties;

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">图作</span>
          <span className="brand-subtitle">透明图表工具</span>
        </div>

        <div className="export-toolbar">
          <div className="ratio-control" aria-label="PNG 导出倍率">
            {[1, 2, 4].map((ratio) => (
              <button
                key={ratio}
                type="button"
                className={pixelRatio === ratio ? "active" : ""}
                onClick={() => setPixelRatio(ratio)}
                aria-pressed={pixelRatio === ratio}
              >
                {ratio}×
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={copyPng}
            title="复制透明 PNG"
            aria-label="复制透明 PNG"
            disabled={exporting}
          >
            <Clipboard size={17} />
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={exportSvg}
          >
            <Download size={17} />
            SVG
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={exportPng}
            disabled={exporting}
          >
            {exporting ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ImageDown size={17} />
            )}
            PNG
          </button>
        </div>
      </header>

      <div className="studio-grid">
        <aside className="panel panel-left">
          <section className="panel-section">
            <div className="section-heading">
              <span>图表</span>
              <span className="step-index">01</span>
            </div>
            <div className="chart-type-grid">
              {CHART_TYPES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={chartType === item.id ? "selected" : ""}
                    onClick={() => selectChartType(item.id)}
                    aria-pressed={chartType === item.id}
                    data-chart-type={item.id}
                  >
                    <Icon
                      size={19}
                      className={
                        item.id === "horizontalBar" ? "rotate-icon" : ""
                      }
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-section data-section">
            <div className="section-heading">
              <span>数据</span>
              <span className="step-index">02</span>
            </div>
            <div className="data-actions">
              <button
                type="button"
                className="button button-secondary upload-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp size={16} />
                上传 CSV / TSV
              </button>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={handleFile}
                data-testid="file-input"
              />
              <span
                className={`data-status ${parsed.error ? "error" : ""}`}
                title={parsed.error}
              >
                {parsed.error
                  ? parsed.error
                  : `${parsed.rows.length} 行 · ${parsed.headers.length} 列`}
              </span>
            </div>
            <textarea
              className="data-editor"
              value={rawData}
              onChange={(event) => setRawData(event.target.value)}
              spellCheck={false}
              aria-label="图表数据"
              data-testid="data-editor"
            />
            <div className="data-foot">
              <Table2 size={14} />
              <span>{parsed.delimiter === "\t" ? "制表符" : "逗号"}分隔</span>
            </div>
          </section>
        </aside>

        <section className="canvas-panel" ref={previewHostRef}>
          <div className="canvas-meta">
            <span>
              {width} × {height}
            </span>
            <span>{Math.round(previewScale * 100)}%</span>
          </div>
          <div className="preview-stage" style={previewStyle}>
            <div
              className={`preview-document ${
                transparent ? "is-transparent" : "is-solid"
              }`}
            >
              <div ref={chartElementRef} className="chart-root" />
            </div>
          </div>
        </section>

        <aside className="panel panel-right">
          <section className="panel-section">
            <div className="section-heading">
              <span>内容</span>
              <Settings2 size={15} />
            </div>
            <label className="field">
              <span>标题</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field">
              <span>副标题</span>
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>{chartType === "scatter" ? "横轴数值" : "分类"}</span>
                <select
                  value={selectedXColumn}
                  onChange={(event) => setXColumn(event.target.value)}
                >
                  {(chartType === "scatter"
                    ? parsed.numericHeaders
                    : parsed.headers
                  ).map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>数值</span>
                <select
                  value={selectedYColumn}
                  onChange={(event) => setYColumn(event.target.value)}
                >
                  {parsed.numericHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {chartType !== "pie" && chartType !== "scatter" && (
              <label className="field">
                <span>对比数值</span>
                <select
                  value={selectedY2Column}
                  onChange={(event) => setY2Column(event.target.value)}
                >
                  <option value="">不显示</option>
                  {parsed.numericHeaders
                    .filter((header) => header !== selectedYColumn)
                    .map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>样式</span>
              <span className="step-index">03</span>
            </div>
            <div className="theme-list">
              {THEMES.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={themeId === candidate.id ? "selected" : ""}
                  onClick={() => selectTheme(candidate)}
                  aria-pressed={themeId === candidate.id}
                >
                  <span className="theme-swatches" aria-hidden="true">
                    {candidate.colors.slice(0, 4).map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span>{candidate.name}</span>
                  {themeId === candidate.id && <Check size={14} />}
                </button>
              ))}
            </div>
            <div className="color-row">
              <label>
                <span>主色</span>
                <span className="color-input-wrap">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    aria-label="主色"
                  />
                  <span>{primaryColor.toUpperCase()}</span>
                </span>
              </label>
              <label>
                <span>对比色</span>
                <span className="color-input-wrap">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(event) => setSecondaryColor(event.target.value)}
                    aria-label="对比色"
                  />
                  <span>{secondaryColor.toUpperCase()}</span>
                </span>
              </label>
            </div>
            <Toggle
              label="透明背景"
              checked={transparent}
              onChange={setTransparent}
            />
            <Toggle
              label="数据标签"
              checked={showLabels}
              onChange={setShowLabels}
            />
            <Toggle
              label="图例"
              checked={showLegend}
              onChange={setShowLegend}
            />
            {isCartesian && (
              <Toggle
                label="网格线"
                checked={showGrid}
                onChange={setShowGrid}
              />
            )}
            {canSmooth && (
              <Toggle
                label="平滑曲线"
                checked={smooth}
                onChange={setSmooth}
              />
            )}
          </section>

          <section className="panel-section size-section">
            <div className="section-heading">
              <span>画布</span>
              <span className="step-index">04</span>
            </div>
            <div className="field-row">
              <label className="field">
                <span>宽度</span>
                <input
                  type="number"
                  min={320}
                  max={2400}
                  step={10}
                  value={width}
                  onChange={(event) =>
                    setWidth(
                      Math.min(
                        2400,
                        Math.max(320, Number(event.target.value) || 320),
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>高度</span>
                <input
                  type="number"
                  min={240}
                  max={1800}
                  step={10}
                  value={height}
                  onChange={(event) =>
                    setHeight(
                      Math.min(
                        1800,
                        Math.max(240, Number(event.target.value) || 240),
                      ),
                    )
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>字号</span>
              <select
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              >
                <option value={12}>小 · 12 px</option>
                <option value={14}>标准 · 14 px</option>
                <option value={16}>大 · 16 px</option>
                <option value={18}>特大 · 18 px</option>
              </select>
            </label>
          </section>

          <div className="panel-footer">
            <button
              type="button"
              className="reset-button"
              onClick={resetAll}
              title="恢复示例"
            >
              <RefreshCcw size={15} />
              恢复示例
            </button>
          </div>
        </aside>
      </div>

      {status && (
        <div className="toast" role="status">
          <Check size={16} />
          {status}
        </div>
      )}
    </main>
  );
}
