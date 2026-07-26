"use client";

import type { ECharts } from "echarts";
import {
  AreaChart,
  BarChart3,
  Check,
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
  Search,
  Settings2,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  CSSProperties,
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

const DEFAULT_MARGINS: Margins = {
  top: 28,
  right: 32,
  bottom: 36,
  left: 38,
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
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
  const [categoryColumn, setCategoryColumn] = useState("月份");
  const [seriesColumns, setSeriesColumns] = useState([
    "实际收入",
    "目标",
  ]);
  const [themeId, setThemeId] = useState("editorial");
  const [primaryColor, setPrimaryColor] = useState(THEMES[0].colors[0]);
  const [secondaryColor, setSecondaryColor] = useState("#4aa7f3");
  const [transparent, setTransparent] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [margins, setMargins] = useState<Margins>(DEFAULT_MARGINS);
  const [marginsLinked, setMarginsLinked] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [smooth, setSmooth] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [pixelRatio, setPixelRatio] = useState(2);
  const [previewScale, setPreviewScale] = useState(1);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => tableToParsed(tableData), [tableData]);
  const theme =
    THEMES.find((candidate) => candidate.id === themeId) ?? THEMES[0];
  const selectedTemplate =
    CHART_TEMPLATES.find((template) => template.id === chartType) ??
    CHART_TEMPLATES[0];
  const selectedCategory = parsed.headers.includes(categoryColumn)
    ? categoryColumn
    : parsed.headers.find(
        (header) => !parsed.numericHeaders.includes(header),
      ) ?? parsed.headers[0] ?? "";
  const selectedSeries = seriesColumns.filter((header) =>
    parsed.numericHeaders.includes(header),
  );
  const effectiveSeries = selectedSeries.length
    ? selectedSeries
    : parsed.numericHeaders.slice(0, 1);

  const option = useMemo(
    () =>
      buildChartOption({
        type: chartType,
        parsed,
        categoryColumn: selectedCategory,
        seriesColumns: effectiveSeries,
        title,
        subtitle,
        width,
        height,
        margins,
        theme,
        primaryColor,
        secondaryColor,
        backgroundColor,
        transparent,
        showLabels,
        showLegend,
        showGrid,
        smooth,
        fontSize,
      }),
    [
      backgroundColor,
      chartType,
      effectiveSeries,
      fontSize,
      height,
      margins,
      parsed,
      primaryColor,
      secondaryColor,
      selectedCategory,
      showGrid,
      showLabels,
      showLegend,
      smooth,
      subtitle,
      theme,
      title,
      transparent,
      width,
    ],
  );
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
    const frame = window.requestAnimationFrame(() => {
      chartRef.current?.resize({ width, height });
      chartRef.current?.setOption(option, true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [height, option, width, workspaceMode]);

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

  function selectTheme(nextTheme: (typeof THEMES)[number]) {
    setThemeId(nextTheme.id);
    setPrimaryColor(nextTheme.colors[0]);
    setSecondaryColor(nextTheme.colors[1]);
  }

  function selectTemplate(type: ChartType) {
    setChartType(type);
    setTemplateOpen(false);
    setWorkspaceMode("preview");
  }

  function toggleSeries(header: string) {
    setSeriesColumns((current) => {
      if (current.includes(header)) {
        return current.length > 1
          ? current.filter((candidate) => candidate !== header)
          : current;
      }
      return [...current, header];
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
        if (categoryColumn === previousHeader) setCategoryColumn(value);
        setSeriesColumns((columns) =>
          columns.map((column) => (column === previousHeader ? value : column)),
        );
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
    setSeriesColumns((current) =>
      current.filter((header) => header !== removedHeader),
    );
    if (categoryColumn === removedHeader) {
      setCategoryColumn(tableData[0]?.[index === 0 ? 1 : 0] ?? "");
    }
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

  async function createPngBlob() {
    if (!chartRef.current) throw new Error("图表尚未准备好");
    return svgToPngBlob(
      chartRef.current.getSvgDataURL(),
      width,
      height,
      pixelRatio,
      transparent ? null : backgroundColor,
    );
  }

  async function exportPng() {
    setExporting(true);
    try {
      downloadBlob(
        await createPngBlob(),
        `${title || "图表"}@${pixelRatio}x.png`,
      );
      setStatus("PNG 已导出");
    } catch {
      setStatus("PNG 导出失败");
    } finally {
      setExporting(false);
    }
  }

  function exportSvg() {
    if (!chartRef.current) return;
    downloadDataUrl(
      chartRef.current.getSvgDataURL(),
      `${title || "图表"}.svg`,
    );
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
    setTableData(INITIAL_TABLE.map((row) => [...row]));
    setChartType("groupedColumn");
    setWorkspaceMode("preview");
    setTitle("上半年收入趋势");
    setSubtitle("单位：万元");
    setWidth(960);
    setHeight(540);
    setCategoryColumn("月份");
    setSeriesColumns(["实际收入", "目标"]);
    setThemeId("editorial");
    setPrimaryColor(THEMES[0].colors[0]);
    setSecondaryColor("#4aa7f3");
    setTransparent(true);
    setBackgroundColor("#ffffff");
    setMargins(DEFAULT_MARGINS);
    setMarginsLinked(false);
    setShowLabels(true);
    setShowLegend(true);
    setShowGrid(true);
    setSmooth(true);
    setFontSize(14);
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
                  size={22}
                />
              </span>
              <span>
                <strong>{selectedTemplate.name}</strong>
                <small>从 20 种模板中选择</small>
              </span>
              <Columns3 size={17} />
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
            <label className="field">
              <span>分类</span>
              <select
                value={selectedCategory}
                onChange={(event) => setCategoryColumn(event.target.value)}
              >
                {parsed.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
            <div className="series-list">
              <span className="field-caption">数值系列</span>
              {parsed.numericHeaders.map((header, index) => (
                <label key={header} className="series-option">
                  <input
                    type="checkbox"
                    checked={effectiveSeries.includes(header)}
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
                  {effectiveSeries.includes(header) && <Check size={13} />}
                </label>
              ))}
            </div>
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
                <div ref={chartElementRef} className="chart-root" />
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
          <section className="panel-section">
            <div className="section-heading">
              <span>配色</span>
              <Palette size={15} />
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
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>画布</span>
              <Settings2 size={15} />
            </div>
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
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>显示</span>
              <span className="step-index">04</span>
            </div>
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
            <Toggle
              label="网格线"
              checked={showGrid}
              onChange={setShowGrid}
            />
            <Toggle
              label="平滑曲线"
              checked={smooth}
              onChange={setSmooth}
            />
            <label className="field font-field">
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
            <button type="button" className="reset-button" onClick={resetAll}>
              <RefreshCcw size={15} />
              恢复示例
            </button>
          </div>
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
