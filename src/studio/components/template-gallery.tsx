"use client";

import {
  AreaChart,
  BarChart3,
  Check,
  LayoutGrid,
  LineChart,
  PieChart,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  buildThumbnailOption,
  CHART_TEMPLATES,
  type ChartFamily,
  type ChartType,
} from "../../../app/chart-model";
import { useDialogFocus } from "../hooks/use-dialog-focus";

export function ChartFamilyIcon({
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

const templateThumbnailCache = new Map<ChartType, string>();

function TemplateThumbnail({ type }: { type: ChartType }) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState(() => templateThumbnailCache.get(type) ?? "");

  useEffect(() => {
    if (svg) return;
    let cancelled = false;
    const element = elementRef.current;
    if (!element) return;

    async function renderThumbnail() {
      const echarts = await import("echarts");
      if (cancelled) return;
      const chart = echarts.init(null as unknown as HTMLElement, undefined, {
        renderer: "svg",
        ssr: true,
        width: 180,
        height: 95,
      });
      chart.setOption(buildThumbnailOption(type), true);
      const nextSvg = chart.renderToSVGString();
      chart.dispose();
      if (cancelled) return;
      templateThumbnailCache.set(type, nextSvg);
      setSvg(nextSvg);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void renderThumbnail();
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [svg, type]);

  return (
    <div
      className="template-thumbnail"
      ref={elementRef}
      aria-hidden="true"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export function TemplateGallery({
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
  const dialogRef = useDialogFocus<HTMLDivElement>({ open, onClose });

  if (!open) return null;

  const filtered = CHART_TEMPLATES.filter((template) =>
    template.name.includes(query.trim()),
  );

  return (
    <div className="template-overlay">
      <div
        ref={dialogRef}
        className="template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-dialog-title"
        tabIndex={-1}
      >
        <div className="template-gallery-header">
          <h1 id="template-dialog-title">图表模板</h1>
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
