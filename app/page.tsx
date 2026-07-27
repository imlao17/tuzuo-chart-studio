"use client";

import { init as initECharts, type ECharts } from "echarts";
import {
  AlertTriangle,
  AreaChart,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Clipboard,
  Columns3,
  Download,
  FileUp,
  ImageDown,
  LayoutGrid,
  LineChart,
  LoaderCircle,
  Lock,
  LockOpen,
  Palette,
  PieChart,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildChartOption,
  buildThumbnailOption,
  CHART_TEMPLATES,
  ChartFamily,
  ChartType,
  INITIAL_TABLE,
  Margins,
  parseDelimitedTable,
  tableToParsed,
  THEMES,
} from "./chart-model";
import {
  type DataBindingRole,
  getTemplateDefinition,
} from "./template-definition";

const DEFAULT_MARGINS: Margins = {
  top: 28,
  right: 32,
  bottom: 36,
  left: 38,
};

type SavedPalette = {
  id: string;
  name: string;
  colors: string[];
};

// Field role bindings: single-column roles map to a string, the multi-column
// `value` role maps to a string[] (selection order = render order). Missing
// roles are resolved with sensible fallbacks by `resolveFieldBindings`.
type FieldRoles = Partial<Record<DataBindingRole, string | string[]>>;

type SettingsSectionId =
  | "colors"
  | "marks"
  | "labels"
  | "xAxis"
  | "yAxis"
  | "legend"
  | "numbers"
  | "canvas";

const DEFAULT_SETTINGS_OPEN: Record<SettingsSectionId, boolean> = {
  colors: true,
  marks: false,
  labels: false,
  xAxis: false,
  yAxis: false,
  legend: false,
  numbers: false,
  canvas: true,
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.requestAnimationFrame(() => link.remove());
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function parseColorOverrides(input: string) {
  return Object.fromEntries(
    input
      .split(/\r?\n/)
      .map((line) => line.split("::").map((part) => part.trim()))
      .filter(
        (parts): parts is [string, string] =>
          parts.length >= 2 &&
          Boolean(parts[0]) &&
          /^#[0-9a-f]{6}$/i.test(parts[1]),
      )
      .map(([name, color]) => [name, color]),
  );
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "图表"
  );
}

function renderPngDataUrl({
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

  const exportChart = initECharts(exportHost, undefined, {
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

function SettingsSection({
  title,
  icon,
  open,
  hidden,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  hidden?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (hidden) return null;

  return (
    <section className="settings-section">
      <button
        type="button"
        className="settings-section-trigger"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="settings-section-title">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={15}
          className={open ? "settings-chevron is-open" : "settings-chevron"}
        />
      </button>
      {open && <div className="settings-section-body">{children}</div>}
    </section>
  );
}

function ChartFamilyIcon({
  family,
  size,
}: {
  family: ChartFamily;
  size: number;
}) {
  if (family === "line") return <LineChart size={size} />;
  if (family === "area") return <AreaChart size={size} />;
  if (family === "pie") return <PieChart size={size} />;
  if (family === "bar") return <BarChart3 size={size} />;
  return <LayoutGrid size={size} />;
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

function TemplateThumbnail({ type }: { type: ChartType }) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let chart: ECharts | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;

    async function mount() {
      if (!elementRef.current) return;
      const echarts = await import("echarts");
      const initialize = () => {
        if (cancelled || !elementRef.current) return;
        if (
          elementRef.current.clientWidth === 0 ||
          elementRef.current.clientHeight === 0
        ) {
          frame = window.requestAnimationFrame(initialize);
          return;
        }
        chart = echarts.init(elementRef.current, undefined, { renderer: "svg" });
        chart.setOption(buildThumbnailOption(type), true);
        observer = new ResizeObserver(() => chart?.resize());
        observer.observe(elementRef.current);
      };
      frame = window.requestAnimationFrame(initialize);
    }

    mount();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      chart?.dispose();
    };
  }, [type]);

  return <div className="template-thumbnail" ref={elementRef} />;
}

function TemplateGallery({
  open,
  selected,
  onClose,
  onSelect,
}: {
  open: boolean;
  selected: ChartType;
  onClose: () => void;
  onSelect: (type: ChartType) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const filtered = CHART_TEMPLATES.filter((template) =>
    template.name.includes(query.trim()),
  );

  return (
    <div className="template-overlay" role="dialog" aria-modal="true">
      <div className="template-dialog">
        <div className="template-gallery-header">
          <h1>折线、柱状与饼图</h1>
          <div className="gallery-actions">
            <label className="template-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索图表"
                autoFocus
              />
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="关闭模板库"
              title="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="template-grid">
          {filtered.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`template-card ${
                selected === template.id ? "selected" : ""
              }`}
              onClick={() => onSelect(template.id)}
            >
              <TemplateThumbnail type={template.id} />
              <span className="template-name">{template.name}</span>
              {selected === template.id && (
                <span className="template-selected">
                  <Check size={13} />
                </span>
              )}
            </button>
          ))}
        </div>
        {!filtered.length && <div className="empty-search">没有匹配的图表</div>}
      </div>
    </div>
  );
}

export default function Home() {
  const [tableData, setTableData] = useState<string[][]>(() =>
    INITIAL_TABLE.map((row) => [...row]),
  );
  const [chartType, setChartType] = useState<ChartType>("groupedColumn");
  const [workspaceMode, setWorkspaceMode] = useState<"preview" | "data">(
    "preview",
  );
  const [templateOpen, setTemplateOpen] = useState(false);
  const [title, setTitle] = useState("上半年收入趋势");
  const [subtitle, setSubtitle] = useState("单位：万元");
  const [width, setWidth] = useState(960);
  const [height, setHeight] = useState(540);
  const [fieldRoles, setFieldRoles] = useState<FieldRoles>({
    category: "月份",
    value: ["实际收入", "目标"],
  });
  // Combo chart only: per-series bar/line role. Empty = renderer falls back to
  // the legacy rule (first series bar, rest line), so default output is stable.
  const [seriesKind, setSeriesKind] = useState<
    Record<string, "bar" | "line">
  >({});
  const [themeId, setThemeId] = useState("editorial");
  const [paletteColors, setPaletteColors] = useState<string[]>([
    ...THEMES[0].colors,
  ]);
  const [customPalettes, setCustomPalettes] = useState<SavedPalette[]>([]);
  const [palettesLoaded, setPalettesLoaded] = useState(false);
  const [paletteName, setPaletteName] = useState("我的配色");
  const [colorOverridesText, setColorOverridesText] = useState("");
  const [transparent, setTransparent] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [margins, setMargins] = useState<Margins>(DEFAULT_MARGINS);
  const [marginsLinked, setMarginsLinked] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [smooth, setSmooth] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [lineWidth, setLineWidth] = useState(3);
  const [pointSize, setPointSize] = useState(7);
  const [barWidth, setBarWidth] = useState(48);
  const [barRadius, setBarRadius] = useState(3);
  // P1-1 bar deepening: category sort, stack totals, stack order, group gaps.
  // Empty = renderer default (no sort / no totals / ECharts default spacing).
  const [sortCategories, setSortCategories] = useState<
    { bySeries: string; order: "asc" | "desc" } | null
  >(null);
  const [showStackTotals, setShowStackTotals] = useState(false);
  const [stackOrder, setStackOrder] = useState<"asc" | "desc" | null>(null);
  const [barGap, setBarGap] = useState<number | null>(null);
  const [barCategoryGap, setBarCategoryGap] = useState<number | null>(null);
  const [markOpacity, setMarkOpacity] = useState(100);
  const [areaOpacity, setAreaOpacity] = useState(22);
  const [labelPosition, setLabelPosition] = useState<
    "auto" | "inside" | "outside"
  >("auto");
  const [showXAxis, setShowXAxis] = useState(true);
  const [showYAxis, setShowYAxis] = useState(true);
  const [xAxisTitle, setXAxisTitle] = useState("");
  const [yAxisTitle, setYAxisTitle] = useState("");
  const [axisLabelRotation, setAxisLabelRotation] = useState(0);
  const [yAxisMin, setYAxisMin] = useState("");
  const [yAxisMax, setYAxisMax] = useState("");
  const [legendPosition, setLegendPosition] = useState<
    "top" | "bottom" | "left" | "right"
  >("top");
  const [showTooltip, setShowTooltip] = useState(true);
  const [gridLineType, setGridLineType] = useState<
    "solid" | "dashed" | "dotted"
  >("dashed");
  const [numberDecimals, setNumberDecimals] = useState(0);
  const [numberPrefix, setNumberPrefix] = useState("");
  const [numberSuffix, setNumberSuffix] = useState("");
  const [useThousandsSeparator, setUseThousandsSeparator] = useState(true);
  const [titleAlign, setTitleAlign] = useState<"left" | "center" | "right">(
    "left",
  );
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsOpen, setSettingsOpen] =
    useState<Record<SettingsSectionId, boolean>>(DEFAULT_SETTINGS_OPEN);
  const [pixelRatio, setPixelRatio] = useState(2);
  const [previewScale, setPreviewScale] = useState(1);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => tableToParsed(tableData), [tableData]);
  const colorOverrides = useMemo(
    () => parseColorOverrides(colorOverridesText),
    [colorOverridesText],
  );
  const primaryColor = paletteColors[0] ?? THEMES[0].colors[0];
  const secondaryColor = paletteColors[1] ?? primaryColor;
  const theme =
    THEMES.find((candidate) => candidate.id === themeId) ?? THEMES[0];
  const selectedTemplate =
    CHART_TEMPLATES.find((template) => template.id === chartType) ??
    CHART_TEMPLATES[0];
  const templateDefinition = getTemplateDefinition(chartType);

  // Resolve the user's field-role bindings into the categoryColumn +
  // seriesColumns shape the renderers still consume. This is the single
  // adapter that lets the UI be role-driven while the renderers stay
  // unchanged. Behavior matches the legacy selectedCategory/effectiveSeries
  // fallbacks for the generic templates, and the per-template selectedColumns
  // fallbacks for scatter (X/Y) and diverging (left/right).
  const { categoryColumn, seriesColumns, resolvedRoles } = useMemo(() => {
    const headers = parsed.headers;
    const numeric = parsed.numericHeaders;
    const firstNumeric = numeric[0] ?? "";

    const resolveCategory = () => {
      const bound = fieldRoles.category;
      if (typeof bound === "string" && headers.includes(bound)) return bound;
      return (
        headers.find((h) => !numeric.includes(h)) ?? headers[0] ?? ""
      );
    };

    const resolveSingle = (
      role: DataBindingRole,
      fallbackIndex: number,
    ): string => {
      const bound = fieldRoles[role];
      if (typeof bound === "string" && numeric.includes(bound)) return bound;
      return numeric[fallbackIndex] ?? firstNumeric;
    };

    const categoryColumn = resolveCategory();
    // Per-role resolved values, so the single-column <select>s can display
    // exactly what the renderer will receive (including fallbacks), instead of
    // a raw (possibly undefined) binding that drifts from the rendered chart.
    const resolvedRoles: Partial<Record<DataBindingRole, string>> = {
      category: categoryColumn,
    };

    // Inspect the template's declared roles to decide how to assemble the
    // series columns. Each template family maps cleanly to one case.
    const roles = new Set(templateDefinition.dataBindings.map((b) => b.role));
    let seriesColumns: string[];
    if (roles.has("x") || roles.has("y")) {
      // scatter: X then Y, mirroring the renderer's selectedColumns[0]/[1].
      const x = resolveSingle("x", 0);
      const y = resolveSingle("y", 1) || x;
      seriesColumns = [x, y];
      resolvedRoles.x = x;
      resolvedRoles.y = y;
    } else if (roles.has("leftValue") || roles.has("rightValue")) {
      // diverging / pyramid: left then right, mirroring dataSeries[0]/[1].
      const left = resolveSingle("leftValue", 0);
      const right = resolveSingle("rightValue", 1) || left;
      seriesColumns = [left, right];
      resolvedRoles.leftValue = left;
      resolvedRoles.rightValue = right;
    } else {
      // generic multi-series templates: value role, selection order preserved.
      const selected = (fieldRoles.value as string[] | undefined)?.filter(
        (header) => numeric.includes(header),
      ) ?? [];
      seriesColumns = selected.length ? selected : numeric.slice(0, 1);
    }

    return { categoryColumn, seriesColumns, resolvedRoles };
  }, [
    fieldRoles,
    parsed.headers,
    parsed.numericHeaders,
    templateDefinition.dataBindings,
  ]);

  const option = useMemo(
    () =>
      buildChartOption({
        type: chartType,
        parsed,
        categoryColumn,
        seriesColumns,
        title,
        subtitle,
        width,
        height,
        margins,
        theme,
        primaryColor,
        secondaryColor,
        paletteColors,
        colorOverrides,
        backgroundColor,
        transparent,
        showLabels,
        showLegend,
        showGrid,
        smooth,
        fontSize,
        lineWidth,
        pointSize,
        barWidth,
        barRadius,
        sortCategories: sortCategories ?? undefined,
        showStackTotals: showStackTotals || undefined,
        stackOrder: stackOrder ?? undefined,
        barGap: barGap ?? undefined,
        barCategoryGap: barCategoryGap ?? undefined,
        markOpacity,
        areaOpacity,
        labelPosition,
        showXAxis,
        showYAxis,
        xAxisTitle,
        yAxisTitle,
        axisLabelRotation,
        yAxisMin,
        yAxisMax,
        legendPosition,
        showTooltip,
        gridLineType,
        numberDecimals,
        numberPrefix,
        numberSuffix,
        useThousandsSeparator,
        titleAlign,
        seriesKind,
      }),
    [
      areaOpacity,
      axisLabelRotation,
      backgroundColor,
      barCategoryGap,
      barGap,
      barRadius,
      barWidth,
      categoryColumn,
      chartType,
      colorOverrides,
      fontSize,
      gridLineType,
      height,
      labelPosition,
      legendPosition,
      lineWidth,
      margins,
      markOpacity,
      numberDecimals,
      numberPrefix,
      numberSuffix,
      paletteColors,
      parsed,
      pointSize,
      primaryColor,
      secondaryColor,
      seriesColumns,
      seriesKind,
      showGrid,
      showLabels,
      showLegend,
      showStackTotals,
      showTooltip,
      showXAxis,
      showYAxis,
      smooth,
      sortCategories,
      stackOrder,
      subtitle,
      theme,
      title,
      titleAlign,
      transparent,
      useThousandsSeparator,
      width,
      xAxisTitle,
      yAxisMax,
      yAxisMin,
      yAxisTitle,
    ],
  );
  const [pngDownload, setPngDownload] = useState<{
    option: typeof option;
    pixelRatio: number;
    objectUrl: string;
    blob: Blob;
  } | null>(null);

  // Run the current template's validators against the resolved field bindings.
  // The first non-null message wins and is shown as a preview overlay; while a
  // data error is present the chart is cleared and PNG export is skipped, so
  // the user never sees a blank or misleading chart from insufficient data.
  const dataError = useMemo(() => {
    const ctx = { parsed, categoryColumn, seriesColumns };
    for (const validator of templateDefinition.validators) {
      const message = validator.validate(ctx);
      if (message) return message;
    }
    return null;
  }, [templateDefinition.validators, parsed, categoryColumn, seriesColumns]);

  const pngDownloadReady =
    !dataError &&
    pngDownload?.option === option &&
    pngDownload.pixelRatio === pixelRatio;
  const initialChartStateRef = useRef({ height, option, width });

  useEffect(() => {
    let cancelled = false;

    async function mountChart() {
      if (!chartElementRef.current || chartRef.current) return;
      if (cancelled || !chartElementRef.current) return;
      const initial = initialChartStateRef.current;
      chartRef.current = initECharts(chartElementRef.current, undefined, {
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
    const frame = window.requestAnimationFrame(() => {
      // When data validation fails, clear any previously rendered chart so the
      // preview overlay is the only thing visible (no stale/misleading chart).
      if (dataError) {
        chartRef.current?.clear();
        return;
      }
      chartRef.current?.resize({ width, height });
      chartRef.current?.setOption(option, true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dataError, height, option, width, workspaceMode]);

  useEffect(() => {
    // While data validation fails there is no valid chart to export: skip PNG
    // generation entirely. pngDownloadReady already factors in dataError, so
    // the export buttons show their not-ready state without needing to clear
    // the (now-stale) pngDownload state here.
    if (dataError) return;
    let objectUrl = "";
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const dataUrl = renderPngDataUrl({
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

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host) return;

    const updateScale = () => {
      const availableWidth = Math.max(300, host.clientWidth - 54);
      const availableHeight = Math.max(280, host.clientHeight - 56);
      setPreviewScale(
        Math.min(1, availableWidth / width, availableHeight / height),
      );
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(host);
    updateScale();
    return () => observer.disconnect();
  }, [height, width, workspaceMode]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    let nextPalettes: SavedPalette[] = [];
    try {
      const saved = window.localStorage.getItem("tuzuo-custom-palettes");
      if (saved) nextPalettes = JSON.parse(saved) as SavedPalette[];
    } catch {
      nextPalettes = [];
    }
    const frame = window.requestAnimationFrame(() => {
      setCustomPalettes(nextPalettes);
      setPalettesLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!palettesLoaded) return;
    window.localStorage.setItem(
      "tuzuo-custom-palettes",
      JSON.stringify(customPalettes),
    );
  }, [customPalettes, palettesLoaded]);

  function selectTheme(nextTheme: (typeof THEMES)[number]) {
    setThemeId(nextTheme.id);
    setPaletteColors([...nextTheme.colors]);
  }

  function selectSavedPalette(palette: SavedPalette) {
    setThemeId(palette.id);
    setPaletteColors([...palette.colors]);
    setPaletteName(palette.name);
  }

  function updatePaletteColor(index: number, color: string) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    setThemeId("custom");
    setPaletteColors((current) =>
      current.map((candidate, colorIndex) =>
        colorIndex === index ? color : candidate,
      ),
    );
  }

  function movePaletteColor(index: number, direction: -1 | 1) {
    setThemeId("custom");
    setPaletteColors((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addPaletteColor() {
    setThemeId("custom");
    setPaletteColors((current) => [
      ...current,
      THEMES[0].colors[current.length % THEMES[0].colors.length],
    ]);
  }

  function removePaletteColor(index: number) {
    if (paletteColors.length <= 2) return;
    setThemeId("custom");
    setPaletteColors((current) =>
      current.filter((_, colorIndex) => colorIndex !== index),
    );
  }

  function saveCurrentPalette() {
    const name = paletteName.trim() || `自定义配色 ${customPalettes.length + 1}`;
    const existing = customPalettes.find(
      (palette) => palette.name.toLowerCase() === name.toLowerCase(),
    );
    const saved: SavedPalette = {
      id: existing?.id ?? `custom-${Date.now()}`,
      name,
      colors: [...paletteColors],
    };
    setCustomPalettes((current) =>
      existing
        ? current.map((palette) => (palette.id === existing.id ? saved : palette))
        : [...current, saved],
    );
    setThemeId(saved.id);
    setPaletteName(name);
    setStatus(existing ? "自定义配色已更新" : "自定义配色已保存");
  }

  function deleteSavedPalette(id: string) {
    setCustomPalettes((current) =>
      current.filter((palette) => palette.id !== id),
    );
    if (themeId === id) setThemeId("custom");
  }

  function toggleSettingsSection(id: SettingsSectionId) {
    setSettingsOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  function settingsSectionVisible(title: string, keywords: string) {
    const query = settingsQuery.trim().toLowerCase();
    return !query || `${title} ${keywords}`.toLowerCase().includes(query);
  }

  // Whether a settings section is declared for the current template. Driven by
  // the registry's settingsGroups so the panel only shows sections that mean
  // something for the current chart (e.g. pie/donut hide X/Y axis sections).
  function sectionInTemplate(id: SettingsSectionId) {
    return templateDefinition.settingsGroups.some((group) => group.id === id);
  }

  // Combined visibility for a section: hidden unless it both belongs to the
  // current template AND matches the settings search query.
  function sectionShown(id: SettingsSectionId, title: string, keywords: string) {
    return sectionInTemplate(id) && settingsSectionVisible(title, keywords);
  }

  function selectTemplate(type: ChartType) {
    setChartType(type);
    setTemplateOpen(false);
    setWorkspaceMode("preview");
  }

  function loadSample() {
    // Load the current template's semantically appropriate sample data into the
    // editor. Replaces the table and the generic category/value field roles,
    // but leaves styling (palette, canvas, margins) untouched. Scatter /
    // diverging / pyramid sample data is designed so the first two numeric
    // columns are X/Y or left/right, so the role-specific bindings can stay
    // unset and the resolver falls back correctly.
    const { sampleData } = templateDefinition;
    setTableData(sampleData.table.map((row) => [...row]));
    setFieldRoles({
      category: sampleData.categoryColumn,
      value: [...sampleData.seriesColumns],
    });
    setStatus("已加载示例数据");
  }

  function toggleSeries(header: string) {
    setFieldRoles((current) => {
      const list = (current.value as string[] | undefined) ?? [];
      if (list.includes(header)) {
        return {
          ...current,
          value:
            list.length > 1
              ? list.filter((candidate) => candidate !== header)
              : list,
        };
      }
      return { ...current, value: [...list, header] };
    });
  }

  function updateMargin(side: keyof Margins, value: number) {
    const next = Math.min(240, Math.max(0, value || 0));
    setMargins((current) => {
      if (marginsLinked) {
        return { top: next, right: next, bottom: next, left: next };
      }
      return { ...current, [side]: next };
    });
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setTableData((current) => {
      const next = current.map((row) => [...row]);
      const previousHeader = next[0]?.[columnIndex] ?? "";
      next[rowIndex][columnIndex] = value;

      if (rowIndex === 0 && previousHeader !== value) {
        // Keep field-role bindings in sync when a column is renamed: rename
        // the header in every role that currently references it.
        setFieldRoles((roles) => {
          const next: FieldRoles = {};
          for (const [role, bound] of Object.entries(roles)) {
            if (typeof bound === "string") {
              next[role as DataBindingRole] =
                bound === previousHeader ? value : bound;
            } else {
              next[role as DataBindingRole] = bound?.map((column) =>
                column === previousHeader ? value : column,
              );
            }
          }
          return next;
        });
      }

      return next;
    });
  }

  function pasteIntoTable(
    event: React.ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startColumn: number,
  ) {
    const clipboardText = event.clipboardData.getData("text/plain");
    if (!clipboardText.includes("\t") && !clipboardText.includes("\n")) return;
    event.preventDefault();
    const pasted = parseDelimitedTable(clipboardText);

    setTableData((current) => {
      const requiredRows = Math.max(current.length, startRow + pasted.length);
      const requiredColumns = Math.max(
        current[0]?.length ?? 2,
        startColumn + Math.max(...pasted.map((row) => row.length)),
      );
      const next = Array.from({ length: requiredRows }, (_, rowIndex) =>
        Array.from(
          { length: requiredColumns },
          (_, columnIndex) => current[rowIndex]?.[columnIndex] ?? "",
        ),
      );

      pasted.forEach((row, rowOffset) => {
        row.forEach((value, columnOffset) => {
          next[startRow + rowOffset][startColumn + columnOffset] = value;
        });
      });
      return next;
    });
    setStatus(`已粘贴 ${pasted.length} 行数据`);
  }

  function addRow() {
    setTableData((current) => [
      ...current,
      Array.from({ length: current[0]?.length ?? 2 }, () => ""),
    ]);
  }

  function deleteRow(index: number) {
    setTableData((current) =>
      current.length > 2 ? current.filter((_, rowIndex) => rowIndex !== index) : current,
    );
  }

  function addColumn() {
    setTableData((current) =>
      current.map((row, rowIndex) => [
        ...row,
        rowIndex === 0 ? `系列 ${row.length}` : "",
      ]),
    );
  }

  function deleteColumn(index: number) {
    if ((tableData[0]?.length ?? 0) <= 2) return;
    const removedHeader = tableData[0]?.[index] ?? "";
    setTableData((current) =>
      current.map((row) => row.filter((_, columnIndex) => columnIndex !== index)),
    );
    // Drop the deleted header from every role binding. resolveFieldBindings
    // will fall back to the first available numeric/header column for any
    // role left empty, so no explicit reassignment is needed here.
    setFieldRoles((roles) => {
      const next: FieldRoles = {};
      for (const [role, bound] of Object.entries(roles)) {
        if (typeof bound === "string") {
          if (bound !== removedHeader) next[role as DataBindingRole] = bound;
        } else {
          const filtered = bound?.filter((header) => header !== removedHeader);
          if (filtered?.length) next[role as DataBindingRole] = filtered;
        }
      }
      return next;
    });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const matrix = parseDelimitedTable(await file.text());
      setTableData(matrix);
      setWorkspaceMode("data");
      setStatus(`已载入 ${file.name}`);
    } catch {
      setStatus("文件读取失败");
    } finally {
      event.target.value = "";
    }
  }

  function exportSvg() {
    if (!chartRef.current) return;
    downloadBlob(
      new Blob([chartRef.current.renderToSVGString({ useViewBox: true })], {
        type: "image/svg+xml;charset=utf-8",
      }),
      `${safeFilename(title)}.svg`,
    );
    setStatus("SVG 已导出");
  }

  async function copyPng() {
    setExporting(true);
    try {
      const blob =
        pngDownloadReady && pngDownload
          ? pngDownload.blob
          : await fetch(
              renderPngDataUrl({
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

  function resetAll() {
    setTableData(INITIAL_TABLE.map((row) => [...row]));
    setChartType("groupedColumn");
    setWorkspaceMode("preview");
    setTitle("上半年收入趋势");
    setSubtitle("单位：万元");
    setWidth(960);
    setHeight(540);
    setFieldRoles({ category: "月份", value: ["实际收入", "目标"] });
    setSeriesKind({});
    setThemeId("editorial");
    setPaletteColors([...THEMES[0].colors]);
    setPaletteName("我的配色");
    setColorOverridesText("");
    setTransparent(true);
    setBackgroundColor("#ffffff");
    setMargins(DEFAULT_MARGINS);
    setMarginsLinked(false);
    setShowLabels(true);
    setShowLegend(true);
    setShowGrid(true);
    setSmooth(true);
    setFontSize(14);
    setLineWidth(3);
    setPointSize(7);
    setBarWidth(48);
    setBarRadius(3);
    setSortCategories(null);
    setShowStackTotals(false);
    setStackOrder(null);
    setBarGap(null);
    setBarCategoryGap(null);
    setMarkOpacity(100);
    setAreaOpacity(22);
    setLabelPosition("auto");
    setShowXAxis(true);
    setShowYAxis(true);
    setXAxisTitle("");
    setYAxisTitle("");
    setAxisLabelRotation(0);
    setYAxisMin("");
    setYAxisMax("");
    setLegendPosition("top");
    setShowTooltip(true);
    setGridLineType("dashed");
    setNumberDecimals(0);
    setNumberPrefix("");
    setNumberSuffix("");
    setUseThousandsSeparator(true);
    setTitleAlign("left");
    setSettingsQuery("");
    setSettingsOpen(DEFAULT_SETTINGS_OPEN);
    setPixelRatio(2);
    setStatus("已恢复示例");
  }

  const previewStyle = {
    "--preview-width": `${width * previewScale}px`,
    "--preview-height": `${height * previewScale}px`,
    "--chart-width": `${width}px`,
    "--chart-height": `${height}px`,
    "--preview-scale": previewScale,
    "--solid-background": backgroundColor,
  } as CSSProperties;
  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <BarChart3 size={17} />
          </span>
          <span className="brand-name">图作</span>
          <span className="brand-subtitle">透明图表工具</span>
        </div>

        <div className="workspace-tabs" role="tablist">
          <button
            type="button"
            className={workspaceMode === "preview" ? "active" : ""}
            onClick={() => setWorkspaceMode("preview")}
            role="tab"
            aria-selected={workspaceMode === "preview"}
          >
            <AreaChart size={16} />
            预览
          </button>
          <button
            type="button"
            className={workspaceMode === "data" ? "active" : ""}
            onClick={() => setWorkspaceMode("data")}
            role="tab"
            aria-selected={workspaceMode === "data"}
          >
            <Table2 size={16} />
            数据
          </button>
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
            title="复制 PNG"
            aria-label="复制 PNG"
            disabled={exporting || Boolean(dataError)}
            aria-hidden={Boolean(dataError)}
          >
            <Clipboard size={17} />
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={exportSvg}
            disabled={Boolean(dataError)}
            aria-hidden={Boolean(dataError)}
          >
            <Download size={17} />
            SVG
          </button>
          <a
            className="button button-primary"
            href={pngDownloadReady ? pngDownload?.objectUrl : undefined}
            download={`${safeFilename(title)}@${pixelRatio}x.png`}
            aria-disabled={!pngDownloadReady}
            onClick={(event) => {
              if (dataError) {
                event.preventDefault();
                return;
              }
              if (!pngDownloadReady) {
                event.preventDefault();
                setStatus("PNG 正在准备，请稍候");
                return;
              }
              setStatus("PNG 已开始下载");
            }}
          >
            {!pngDownloadReady ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ImageDown size={17} />
            )}
            PNG
          </a>
        </div>
      </header>

      <div className="studio-grid">
        <aside className="panel panel-left">
          <section className="panel-section">
            <div className="section-heading">
              <span>图表模板</span>
              <span className="step-index">01</span>
            </div>
            <button
              type="button"
              className="current-template"
              onClick={() => setTemplateOpen(true)}
            >
              <span className="current-template-icon">
                <ChartFamilyIcon
                  family={selectedTemplate.family}
                  size={17}
                />
              </span>
              <span>
                <strong>{selectedTemplate.name}</strong>
                <small>20 种图表</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>内容</span>
              <span className="step-index">02</span>
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
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>数据字段</span>
              <Table2 size={15} />
            </div>
            {templateDefinition.dataBindings.map((binding) => {
              const isCategory = binding.role === "category";
              const options = isCategory
                ? parsed.headers
                : parsed.numericHeaders;
              if (binding.multiple) {
                // Multi-column value role: checkbox list, selection order
                // preserved (toggleSeries appends to the end).
                const selected = (fieldRoles.value as string[] | undefined) ??
                  [];
                return (
                  <div key={binding.role} className="series-list">
                    <span className="field-caption">
                      {binding.label}
                      {binding.hint ? ` · ${binding.hint}` : ""}
                    </span>
                    {parsed.numericHeaders.map((header, index) => {
                      const isSelected = selected.includes(header);
                      // Combo only: a per-series 柱/线 toggle lets the user
                      // assign which selected columns render as bars vs lines,
                      // instead of relying on selection order. Default (no
                      // explicit kind) keeps the renderer's legacy rule.
                      const kind =
                        seriesKind[header] ??
                        (index === 0 ? "bar" : "line");
                      return (
                        <label
                          key={header}
                          className={`series-option${
                            isSelected && chartType === "combo"
                              ? " series-option-combo"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSeries(header)}
                          />
                          <span
                            className="series-color"
                            style={{
                              background:
                                index === 0
                                  ? primaryColor
                                  : index === 1
                                    ? secondaryColor
                                    : theme.colors[index % theme.colors.length],
                            }}
                          />
                          <span>{header}</span>
                          {isSelected && chartType === "combo" && (
                            <span className="series-kind" role="group" aria-label={`${header} 图形`}>
                              {(["bar", "line"] as const).map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  className={`series-kind-btn${
                                    kind === option ? " is-active" : ""
                                  }`}
                                  aria-pressed={kind === option}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setSeriesKind((current) => ({
                                      ...current,
                                      [header]: option,
                                    }));
                                  }}
                                >
                                  {option === "bar" ? "柱" : "线"}
                                </button>
                              ))}
                            </span>
                          )}
                          {isSelected && chartType !== "combo" && (
                            <Check size={13} />
                          )}
                        </label>
                      );
                    })}
                  </div>
                );
              }
              // Single-column role (category / x / y / leftValue / rightValue).
              // Display the resolved value (includes fallbacks) so the select
              // always matches what the renderer receives.
              const current = resolvedRoles[binding.role] ?? options[0] ?? "";
              return (
                <label key={binding.role} className="field">
                  <span>{binding.label}</span>
                  <select
                    value={options.includes(current) ? current : (options[0] ?? "")}
                    onChange={(event) =>
                      setFieldRoles((roles) => ({
                        ...roles,
                        [binding.role]: event.target.value,
                      }))
                    }
                  >
                    {options.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            <button
              type="button"
              className="text-button"
              onClick={loadSample}
              title="为当前图表加载示例数据"
            >
              <Sparkles size={14} />
              加载示例
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setWorkspaceMode("data")}
            >
              <Table2 size={14} />
              编辑数据表
            </button>
          </section>
        </aside>

        <section
          className={`canvas-panel ${
            workspaceMode !== "preview" ? "workspace-hidden" : ""
          }`}
          ref={previewHostRef}
          aria-hidden={workspaceMode !== "preview"}
        >
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
                <div
                  ref={chartElementRef}
                  className="chart-root"
                  style={{ display: dataError ? "none" : undefined }}
                />
                {dataError && (
                  <div className="chart-empty" role="alert">
                    <AlertTriangle size={22} />
                    <span>{dataError}</span>
                  </div>
                )}
              </div>
            </div>
        </section>

        <section
          className={`data-workspace ${
            workspaceMode !== "data" ? "workspace-hidden" : ""
          }`}
          aria-hidden={workspaceMode !== "data"}
        >
            <div className="data-toolbar">
              <div>
                <h2>数据表</h2>
                <span>
                  {parsed.rows.length} 行 · {parsed.headers.length} 列
                </span>
              </div>
              <div className="data-toolbar-actions">
                <button
                  type="button"
                  className="button button-secondary"
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
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={addColumn}
                >
                  <Columns3 size={16} />
                  添加列
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={addRow}
                >
                  <Plus size={16} />
                  添加行
                </button>
              </div>
            </div>

            <div className="sheet-shell">
              <div className="sheet-scroll">
                <table className="data-sheet">
                  <thead>
                    <tr>
                      <th className="row-gutter">
                        <Table2 size={15} />
                      </th>
                      {tableData[0]?.map((header, columnIndex) => (
                        <th key={`header-${columnIndex}`}>
                          <input
                            value={header}
                            onChange={(event) =>
                              updateCell(0, columnIndex, event.target.value)
                            }
                            onPaste={(event) =>
                              pasteIntoTable(event, 0, columnIndex)
                            }
                            aria-label={`第 ${columnIndex + 1} 列标题`}
                          />
                          <button
                            type="button"
                            onClick={() => deleteColumn(columnIndex)}
                            disabled={(tableData[0]?.length ?? 0) <= 2}
                            title="删除列"
                            aria-label={`删除第 ${columnIndex + 1} 列`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(1).map((row, rowOffset) => {
                      const rowIndex = rowOffset + 1;
                      return (
                        <tr key={`row-${rowIndex}`}>
                          <th className="row-gutter">
                            <span>{rowIndex}</span>
                            <button
                              type="button"
                              onClick={() => deleteRow(rowIndex)}
                              disabled={tableData.length <= 2}
                              title="删除行"
                              aria-label={`删除第 ${rowIndex} 行`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </th>
                          {tableData[0].map((_, columnIndex) => (
                            <td key={`cell-${rowIndex}-${columnIndex}`}>
                              <input
                                value={row[columnIndex] ?? ""}
                                onChange={(event) =>
                                  updateCell(
                                    rowIndex,
                                    columnIndex,
                                    event.target.value,
                                  )
                                }
                                onPaste={(event) =>
                                  pasteIntoTable(
                                    event,
                                    rowIndex,
                                    columnIndex,
                                  )
                                }
                                aria-label={`第 ${rowIndex} 行第 ${columnIndex + 1} 列`}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="add-row-bar" onClick={addRow}>
                <Plus size={15} />
                添加一行
              </button>
            </div>
            <p className="sheet-hint">可直接从 Excel 或表格软件复制后粘贴到任意单元格</p>
        </section>

        <aside className="panel panel-right">
          <div className="settings-toolbar">
            <label className="settings-search">
              <Search size={14} />
              <input
                value={settingsQuery}
                onChange={(event) => setSettingsQuery(event.target.value)}
                placeholder="搜索设置"
                aria-label="搜索设置"
              />
              {settingsQuery && (
                <button
                  type="button"
                  onClick={() => setSettingsQuery("")}
                  aria-label="清除设置搜索"
                  title="清除"
                >
                  <X size={13} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="settings-reset-icon"
              onClick={resetAll}
              aria-label="恢复示例"
              title="恢复示例"
            >
              <RefreshCcw size={15} />
            </button>
          </div>

          <SettingsSection
            title="配色"
            icon={<Palette size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.colors}
            hidden={!sectionShown("colors", "配色", "颜色 调色板 自定义 品牌 系列")}
            onToggle={() => toggleSettingsSection("colors")}
          >
            <span className="settings-caption">预设方案</span>
            <div className="theme-list compact">
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
                  {themeId === candidate.id && <Check size={13} />}
                </button>
              ))}
            </div>

            {customPalettes.length > 0 && (
              <>
                <span className="settings-caption custom-palette-caption">
                  已保存
                </span>
                <div className="saved-palette-list">
                  {customPalettes.map((palette) => (
                    <div key={palette.id} className="saved-palette-row">
                      <button
                        type="button"
                        className={
                          themeId === palette.id
                            ? "saved-palette-select selected"
                            : "saved-palette-select"
                        }
                        onClick={() => selectSavedPalette(palette)}
                        aria-pressed={themeId === palette.id}
                      >
                        <span className="palette-strip" aria-hidden="true">
                          {palette.colors.slice(0, 6).map((color, index) => (
                            <span
                              key={`${color}-${index}`}
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        <span>{palette.name}</span>
                      </button>
                      <button
                        type="button"
                        className="palette-row-action"
                        onClick={() => deleteSavedPalette(palette.id)}
                        aria-label={`删除配色 ${palette.name}`}
                        title="删除配色"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="palette-editor-heading">
              <span className="settings-caption">当前调色板</span>
              <button
                type="button"
                onClick={addPaletteColor}
                aria-label="添加颜色"
                title="添加颜色"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="palette-editor">
              {paletteColors.map((color, index) => (
                <div className="palette-color-row" key={`${index}-${color}`}>
                  <input
                    type="color"
                    value={color}
                    onChange={(event) =>
                      updatePaletteColor(index, event.target.value)
                    }
                    aria-label={`调色板颜色 ${index + 1}`}
                  />
                  <input
                    className="palette-hex"
                    value={color.toUpperCase()}
                    onChange={(event) =>
                      updatePaletteColor(index, event.target.value)
                    }
                    maxLength={7}
                    aria-label={`颜色 ${index + 1} 色值`}
                  />
                  <div className="palette-reorder">
                    <button
                      type="button"
                      onClick={() => movePaletteColor(index, -1)}
                      disabled={index === 0}
                      aria-label={`颜色 ${index + 1} 左移`}
                      title="左移"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePaletteColor(index, 1)}
                      disabled={index === paletteColors.length - 1}
                      aria-label={`颜色 ${index + 1} 右移`}
                      title="右移"
                    >
                      <ArrowRight size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePaletteColor(index)}
                      disabled={paletteColors.length <= 2}
                      aria-label={`删除颜色 ${index + 1}`}
                      title="删除颜色"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="save-palette-row">
              <input
                value={paletteName}
                onChange={(event) => setPaletteName(event.target.value)}
                placeholder="配色名称"
                aria-label="配色名称"
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={saveCurrentPalette}
              >
                <Save size={14} />
                保存
              </button>
            </div>

            <label className="field settings-field">
              <span>系列颜色覆盖</span>
              <textarea
                value={colorOverridesText}
                onChange={(event) => setColorOverridesText(event.target.value)}
                placeholder={"实际收入 :: #2563eb\n目标 :: #f15a3a"}
                aria-label="系列颜色覆盖"
              />
              <small>每行使用“系列名 :: #色值”</small>
            </label>
          </SettingsSection>

          <SettingsSection
            title="线条、数据点与面积"
            icon={<SlidersHorizontal size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.marks}
            hidden={
              !sectionShown(
                "marks",
                "线条、数据点与面积",
                "柱宽 圆角 透明度 平滑 点大小 样式",
              )
            }
            onToggle={() => toggleSettingsSection("marks")}
          >
            {(selectedTemplate.family === "line" ||
              selectedTemplate.family === "area" ||
              chartType === "combo") && (
              <>
                <label className="range-field">
                  <span>
                    线条宽度 <strong>{lineWidth}px</strong>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={lineWidth}
                    onChange={(event) => setLineWidth(Number(event.target.value))}
                  />
                </label>
                <Toggle
                  label="平滑曲线"
                  checked={smooth}
                  onChange={setSmooth}
                />
              </>
            )}
            {(selectedTemplate.family === "line" ||
              selectedTemplate.family === "area" ||
              chartType === "combo" ||
              chartType === "scatter") && (
              <label className="range-field">
                <span>
                  数据点大小 <strong>{pointSize}px</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={pointSize}
                  onChange={(event) => setPointSize(Number(event.target.value))}
                />
              </label>
            )}
            {(selectedTemplate.family === "bar" ||
              chartType === "combo" ||
              chartType === "divergingBar" ||
              chartType === "populationPyramid") && (
              <>
                <label className="range-field">
                  <span>
                    柱条宽度 <strong>{barWidth}px</strong>
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={96}
                    value={barWidth}
                    onChange={(event) => setBarWidth(Number(event.target.value))}
                  />
                </label>
                <label className="range-field">
                  <span>
                    圆角 <strong>{barRadius}px</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={barRadius}
                    onChange={(event) => setBarRadius(Number(event.target.value))}
                  />
                </label>
                {selectedTemplate.family === "bar" && (
                  <>
                    <label className="field">
                      <span>分类排序</span>
                      <select
                        value={sortCategories ? `${sortCategories.bySeries}:${sortCategories.order}` : ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) {
                            setSortCategories(null);
                            return;
                          }
                          const [bySeries, order] = value.split(":");
                          setSortCategories({
                            bySeries,
                            order: order === "desc" ? "desc" : "asc",
                          });
                        }}
                      >
                        <option value="">默认（原序）</option>
                        {seriesColumns.map((header) => (
                          <optgroup key={header} label={header}>
                            <option value={`${header}:asc`}>升序</option>
                            <option value={`${header}:desc`}>降序</option>
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    {(chartType === "stackedBar" ||
                      chartType === "stackedColumn" ||
                      chartType === "proportionalBar" ||
                      chartType === "proportionalColumn") && (
                      <>
                        <Toggle
                          label="堆叠总计"
                          checked={showStackTotals}
                          onChange={setShowStackTotals}
                        />
                        <label className="field">
                          <span>堆叠顺序</span>
                          <select
                            value={stackOrder ?? ""}
                            onChange={(event) =>
                              setStackOrder(
                                event.target.value === "asc" || event.target.value === "desc"
                                  ? event.target.value
                                  : null,
                              )
                            }
                          >
                            <option value="">默认（原序）</option>
                            <option value="asc">按总量升序</option>
                            <option value="desc">按总量降序</option>
                          </select>
                        </label>
                      </>
                    )}
                    <label className="range-field">
                      <span>
                        组内间距 <strong>{barGap ?? 30}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={barGap ?? 30}
                        onChange={(event) => setBarGap(Number(event.target.value))}
                      />
                    </label>
                    <label className="range-field">
                      <span>
                        组间间距 <strong>{barCategoryGap ?? 20}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={barCategoryGap ?? 20}
                        onChange={(event) => setBarCategoryGap(Number(event.target.value))}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {selectedTemplate.family === "area" && (
              <label className="range-field">
                <span>
                  面积透明度 <strong>{areaOpacity}%</strong>
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={areaOpacity}
                  onChange={(event) => setAreaOpacity(Number(event.target.value))}
                />
              </label>
            )}
            <label className="range-field">
              <span>
                图形不透明度 <strong>{markOpacity}%</strong>
              </span>
              <input
                type="range"
                min={10}
                max={100}
                value={markOpacity}
                onChange={(event) => setMarkOpacity(Number(event.target.value))}
              />
            </label>
          </SettingsSection>

          <SettingsSection
            title="数据标签"
            icon={<Table2 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.labels}
            hidden={!sectionShown("labels", "数据标签", "数值 位置 字号 显示")}
            onToggle={() => toggleSettingsSection("labels")}
          >
            <Toggle
              label="显示数据标签"
              checked={showLabels}
              onChange={setShowLabels}
            />
            <span className="settings-caption">标签位置</span>
            <div className="segmented-control three">
              {(
                [
                  ["auto", "自动"],
                  ["outside", "外侧"],
                  ["inside", "内部"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={labelPosition === value ? "active" : ""}
                  onClick={() => setLabelPosition(value)}
                  aria-pressed={labelPosition === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="field settings-field">
              <span>标签字号</span>
              <select
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              >
                <option value={10}>10 px</option>
                <option value={12}>12 px</option>
                <option value={14}>14 px</option>
                <option value={16}>16 px</option>
                <option value={18}>18 px</option>
                <option value={20}>20 px</option>
              </select>
            </label>
          </SettingsSection>

          <SettingsSection
            title="X 轴"
            icon={<Columns3 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.xAxis}
            hidden={!sectionShown("xAxis", "X 轴", "横轴 标题 标签 旋转")}
            onToggle={() => toggleSettingsSection("xAxis")}
          >
            <Toggle
              label="显示 X 轴"
              checked={showXAxis}
              onChange={setShowXAxis}
            />
            <label className="field settings-field">
              <span>轴标题</span>
              <input
                value={xAxisTitle}
                onChange={(event) => setXAxisTitle(event.target.value)}
                placeholder="留空则不显示"
              />
            </label>
            <label className="range-field">
              <span>
                标签旋转 <strong>{axisLabelRotation}°</strong>
              </span>
              <input
                type="range"
                min={-90}
                max={90}
                step={15}
                value={axisLabelRotation}
                onChange={(event) =>
                  setAxisLabelRotation(Number(event.target.value))
                }
              />
            </label>
          </SettingsSection>

          <SettingsSection
            title="Y 轴"
            icon={<BarChart3 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.yAxis}
            hidden={!sectionShown("yAxis", "Y 轴", "纵轴 范围 最小 最大 网格线")}
            onToggle={() => toggleSettingsSection("yAxis")}
          >
            <Toggle
              label="显示 Y 轴"
              checked={showYAxis}
              onChange={setShowYAxis}
            />
            <label className="field settings-field">
              <span>轴标题</span>
              <input
                value={yAxisTitle}
                onChange={(event) => setYAxisTitle(event.target.value)}
                placeholder="留空则不显示"
              />
            </label>
            <div className="field-row">
              <label className="field settings-field">
                <span>最小值</span>
                <input
                  inputMode="decimal"
                  value={yAxisMin}
                  onChange={(event) => setYAxisMin(event.target.value)}
                  placeholder="自动"
                />
              </label>
              <label className="field settings-field">
                <span>最大值</span>
                <input
                  inputMode="decimal"
                  value={yAxisMax}
                  onChange={(event) => setYAxisMax(event.target.value)}
                  placeholder="自动"
                />
              </label>
            </div>
            <Toggle
              label="显示网格线"
              checked={showGrid}
              onChange={setShowGrid}
            />
            <label className="field settings-field">
              <span>网格线样式</span>
              <select
                value={gridLineType}
                onChange={(event) =>
                  setGridLineType(
                    event.target.value as "solid" | "dashed" | "dotted",
                  )
                }
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </label>
          </SettingsSection>

          <SettingsSection
            title="图例与交互"
            icon={<LayoutGrid size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.legend}
            hidden={!sectionShown("legend", "图例与交互", "位置 提示 悬停 筛选")}
            onToggle={() => toggleSettingsSection("legend")}
          >
            <Toggle
              label="显示图例"
              checked={showLegend}
              onChange={setShowLegend}
            />
            <label className="field settings-field">
              <span>图例位置</span>
              <select
                value={legendPosition}
                onChange={(event) =>
                  setLegendPosition(
                    event.target.value as "top" | "bottom" | "left" | "right",
                  )
                }
              >
                <option value="top">顶部</option>
                <option value="bottom">底部</option>
                <option value="left">左侧</option>
                <option value="right">右侧</option>
              </select>
            </label>
            <Toggle
              label="悬停提示"
              checked={showTooltip}
              onChange={setShowTooltip}
            />
          </SettingsSection>

          <SettingsSection
            title="数字格式"
            icon={<Settings2 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.numbers}
            hidden={!sectionShown("numbers", "数字格式", "小数 千分位 前缀 后缀 单位")}
            onToggle={() => toggleSettingsSection("numbers")}
          >
            <label className="field settings-field">
              <span>小数位数</span>
              <select
                value={numberDecimals}
                onChange={(event) =>
                  setNumberDecimals(Number(event.target.value))
                }
              >
                {[0, 1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-row">
              <label className="field settings-field">
                <span>前缀</span>
                <input
                  value={numberPrefix}
                  onChange={(event) => setNumberPrefix(event.target.value)}
                  placeholder="如 ¥"
                />
              </label>
              <label className="field settings-field">
                <span>后缀</span>
                <input
                  value={numberSuffix}
                  onChange={(event) => setNumberSuffix(event.target.value)}
                  placeholder="如 万元"
                />
              </label>
            </div>
            <Toggle
              label="使用千分位"
              checked={useThousandsSeparator}
              onChange={setUseThousandsSeparator}
            />
          </SettingsSection>

          <SettingsSection
            title="画布与布局"
            icon={<Settings2 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.canvas}
            hidden={!sectionShown("canvas", "画布与布局", "背景 尺寸 边距 标题 对齐 透明")}
            onToggle={() => toggleSettingsSection("canvas")}
          >
            <Toggle
              label="透明背景"
              checked={transparent}
              onChange={setTransparent}
            />
            {!transparent && (
              <label className="background-field">
                <span>背景色</span>
                <span className="color-input-wrap">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    aria-label="背景色"
                  />
                  <span>{backgroundColor.toUpperCase()}</span>
                </span>
              </label>
            )}
            <span className="settings-caption">标题对齐</span>
            <div className="segmented-control three">
              {(
                [
                  ["left", "左"],
                  ["center", "中"],
                  ["right", "右"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={titleAlign === value ? "active" : ""}
                  onClick={() => setTitleAlign(value)}
                  aria-pressed={titleAlign === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="field-row canvas-size-row">
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
            <div className="margin-heading">
              <span>四周边距</span>
              <button
                type="button"
                onClick={() => setMarginsLinked((current) => !current)}
                title={marginsLinked ? "取消联动" : "联动四边"}
                aria-label={marginsLinked ? "取消联动边距" : "联动四周边距"}
              >
                {marginsLinked ? <Lock size={14} /> : <LockOpen size={14} />}
              </button>
            </div>
            <div className="margin-grid">
              {(
                [
                  ["top", "上"],
                  ["right", "右"],
                  ["bottom", "下"],
                  ["left", "左"],
                ] as [keyof Margins, string][]
              ).map(([side, label]) => (
                <label key={side}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={margins[side]}
                    onChange={(event) =>
                      updateMargin(side, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
          </SettingsSection>

          {settingsQuery &&
            ![
              sectionShown("colors", "配色", "颜色 调色板 自定义 品牌 系列"),
              sectionShown(
                "marks",
                "线条、数据点与面积",
                "柱宽 圆角 透明度 平滑 点大小 样式",
              ),
              sectionShown("labels", "数据标签", "数值 位置 字号 显示"),
              sectionShown("xAxis", "X 轴", "横轴 标题 标签 旋转"),
              sectionShown("yAxis", "Y 轴", "纵轴 范围 最小 最大 网格线"),
              sectionShown("legend", "图例与交互", "位置 提示 悬停 筛选"),
              sectionShown("numbers", "数字格式", "小数 千分位 前缀 后缀 单位"),
              sectionShown("canvas", "画布与布局", "背景 尺寸 边距 标题 对齐 透明"),
            ].some(Boolean) && (
              <div className="settings-empty">没有匹配的设置</div>
            )}
        </aside>
      </div>

      <TemplateGallery
        open={templateOpen}
        selected={chartType}
        onClose={() => setTemplateOpen(false)}
        onSelect={selectTemplate}
      />

      {status && (
        <div className="toast" role="status">
          <Check size={16} />
          {status}
        </div>
      )}
    </main>
  );
}
