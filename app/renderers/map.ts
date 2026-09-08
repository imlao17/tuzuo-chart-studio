/**
 * Map family renderer (Flourish parity batch 11).
 *
 * Covers: worldChoropleth, chinaChoropleth, symbolMap, geoHeatmap, flowMap.
 *
 * The GeoJSON for "world"/"china" ships under public/geo and is registered
 * lazily by src/studio/geo/register-maps.ts right before the chart renders;
 * the option builders here only reference the map/geo names. China's GeoJSON
 * already carries Chinese province names; the world GeoJSON uses English
 * names, so choropleths install a geojson→中文 nameMap.
 */
import type { SeriesOption } from "echarts";
import { columnIndex, toNumber } from "../chart-model";
import type { RenderContext, ValidationContext } from "../template-definition";
import {
  colorFor,
  dataLabelTextStyle,
  type RendererResult,
} from "./shared";

/**
 * Whether at least `min` of the category names resolve to known geography
 * (centroid hits for point templates, mapped/province names for choropleths).
 * Templates whose points would all be filtered out should auto-load their
 * sample data instead of rendering an empty-looking map.
 */
export function hasKnownGeoNames(
  ctx: ValidationContext,
  min: number,
  scope: "centroids" | "world" | "china",
): boolean {
  const categoryIndex = columnIndex(ctx.parsed.headers, ctx.categoryColumn);
  const names = ctx.parsed.rows.map((row) => row[categoryIndex]);
  const valueColumn = ctx.seriesColumns.find((header) =>
    ctx.parsed.numericHeaders.includes(header),
  );
  const valueIndex = columnIndex(ctx.parsed.headers, valueColumn ?? "");
  const values = ctx.parsed.rows.map((row) => toNumber(row[valueIndex] ?? ""));
  let hits = 0;
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]?.trim() ?? "";
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    if (scope === "centroids" && COUNTRY_CENTROIDS[name] !== undefined) hits += 1;
    else if (scope === "world" && Object.values(WORLD_NAME_MAP).includes(name)) hits += 1;
    else if (scope === "china" && name.endsWith("省") || name.endsWith("市") || name.endsWith("自治区")) hits += 1;
    if (hits >= min) return true;
  }
  return false;
}

/** GeoJSON (English) name → the Chinese names used in user data. */
const WORLD_NAME_MAP: Record<string, string> = {
  China: "中国",
  "United States of America": "美国",
  "United States": "美国",
  Japan: "日本",
  Germany: "德国",
  India: "印度",
  "United Kingdom": "英国",
  France: "法国",
  Brazil: "巴西",
  Russia: "俄罗斯",
  Canada: "加拿大",
  Australia: "澳大利亚",
  "South Korea": "韩国",
  Korea: "韩国",
  Indonesia: "印度尼西亚",
  Singapore: "新加坡",
  Malaysia: "马来西亚",
  Thailand: "泰国",
  Vietnam: "越南",
  "South Africa": "南非",
  "Saudi Arabia": "沙特阿拉伯",
  Mexico: "墨西哥",
  Argentina: "阿根廷",
  Italy: "意大利",
  Spain: "西班牙",
  Netherlands: "荷兰",
  Switzerland: "瑞士",
  Sweden: "瑞典",
  Norway: "挪威",
  "New Zealand": "新西兰",
  Egypt: "埃及",
  Nigeria: "尼日利亚",
  Kenya: "肯尼亚",
  Turkey: "土耳其",
  Pakistan: "巴基斯坦",
  Bangladesh: "孟加拉国",
  Philippines: "菲律宾",
  Chile: "智利",
  Colombia: "哥伦比亚",
  Poland: "波兰",
  Ukraine: "乌克兰",
  "United Arab Emirates": "阿联酋",
};

/** 中文名 → [lng, lat] centroids for the point-based geo templates. */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  中国: [104.2, 35.8],
  美国: [-98.5, 39.8],
  日本: [138.2, 36.2],
  德国: [10.4, 51.2],
  印度: [78.9, 22.0],
  英国: [-1.5, 52.6],
  法国: [2.5, 46.6],
  巴西: [-51.9, -10.8],
  俄罗斯: [96.4, 61.5],
  加拿大: [-106.3, 56.1],
  澳大利亚: [134.5, -25.7],
  韩国: [127.8, 36.4],
  印度尼西亚: [113.9, -0.8],
  新加坡: [103.8, 1.35],
  马来西亚: [102.0, 4.2],
  泰国: [100.9, 15.1],
  越南: [106.3, 16.6],
  南非: [24.7, -30.6],
  墨西哥: [-102.5, 23.6],
  意大利: [12.6, 42.5],
  西班牙: [-3.7, 40.2],
  荷兰: [5.3, 52.1],
  土耳其: [35.2, 39.0],
  埃及: [30.8, 26.8],
  阿联酋: [54.2, 23.9],
  新西兰: [172.8, -41.5],
};

const PROVINCE_FALLBACK_COLOR = "#e8edf4";

function choroplethFrame(ctx: RenderContext) {
  const { config } = ctx;
  const { compact = false, theme, fontSize } = config;
  return {
    min: 0,
    max: Math.max(1, ...(dataSeriesOf(ctx).map((value) => (Number.isFinite(value) ? value : 0)))),
    calculable: false,
    show: !compact,
    orient: "horizontal" as const,
    left: "center",
    bottom: 0,
    inRange: {
      color: [
        config.backgroundColor === "#ffffff" ? PROVINCE_FALLBACK_COLOR : config.backgroundColor,
        colorFor(0, config),
      ],
    },
    textStyle: { color: theme.text, fontSize },
  };
}

function dataSeriesOf(ctx: RenderContext) {
  return ctx.dataSeries[0]?.data ?? [];
}

function numericBound(context: RenderContext) {
  const values = dataSeriesOf(context);
  const max = Math.max(1, ...values.filter(Number.isFinite));
  return max;
}

/** 分级统计地图（世界 / 中国）: map series colored by value. */
export function buildChoroplethOption(
  ctx: RenderContext,
  mapName: "world" | "china",
): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, fontSize } = config;
  const values = dataSeries[0]?.data ?? [];
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "map",
      map: mapName,
      ...(mapName === "world" ? { nameMap: WORLD_NAME_MAP } : {}),
      roam: false,
      zoom: 1,
      top: compact ? "6%" : "12%",
      bottom: compact ? "12%" : "18%",
      left: "6%",
      right: "6%",
      data: categories.map((name, index) => ({
        name,
        value: Number.isFinite(values[index]) ? values[index] : 0,
      })),
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
        fontSize: Math.max(8, fontSize - 2),
      },
    },
  ];
  return { series, visualMap: choroplethFrame(ctx), tooltipTrigger: "item" };
}

export function buildWorldChoroplethOption(ctx: RenderContext): RendererResult {
  return buildChoroplethOption(ctx, "world");
}

export function buildChinaChoroplethOption(ctx: RenderContext): RendererResult {
  return buildChoroplethOption(ctx, "china");
}

/** Symbol / heat / flow templates: values resolved through the centroid table. */
function resolveCentroids(
  ctx: RenderContext,
  names: string[],
): Array<[number, number] | undefined> {
  void ctx;
  return names.map((name) => COUNTRY_CENTROIDS[name.trim()]);
}

/** 符号地图: geo background + scatter sized by value at country centroids. */
export function buildSymbolMapOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false } = config;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];
  const maxValue = numericBound(ctx);
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "scatter",
      coordinateSystem: "geo",
      itemStyle: { opacity: markOpacity },
      data: categories
        .map((name, index) => {
          const centroid = resolveCentroids(ctx, [name])[0];
          if (!centroid) return null;
          const value = Number.isFinite(values[index]) ? values[index] : 0;
          return {
            name,
            value: [...centroid, value],
            symbolSize: compact ? 5 : Math.max(8, Math.sqrt(value / maxValue) * (pointSize * 4)),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      label: {
        show: compact ? false : config.showLabels,
        position: "right" as const,
        ...labelTextStyle,
        fontSize: Math.max(8, config.fontSize - 2),
      },
      emphasis: { focus: "self" as const },
    },
  ];
  return { series, geo: geoFrame(ctx) };
}

/** 地点热力地图: geo background + heat-sized gradient dots at centroids.
 *  (ECharts' HeatmapLayer on geo is canvas-only and throws under the SVG
 *  renderer this app uses, so heat is expressed as scaled translucent dots.) */
export function buildGeoHeatmapOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false } = config;
  const values = dataSeries[0]?.data ?? [];
  const maxValue = numericBound(ctx);
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "热度",
      type: "scatter",
      coordinateSystem: "geo",
      data: categories
        .map((name, index) => {
          const centroid = resolveCentroids(ctx, [name])[0];
          if (!centroid) return null;
          const value = Number.isFinite(values[index]) ? values[index] : 0;
          return {
            name,
            value: [...centroid, value],
            symbolSize: compact ? 10 : 14 + (value / maxValue) * 26,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      itemStyle: {
        opacity: 0.55,
        shadowBlur: compact ? 4 : 14,
        shadowColor: "rgba(22, 99, 235, 0.35)",
      },
      label: { show: false },
      emphasis: { focus: "self" },
    } as SeriesOption,
  ];
  return {
    series,
    geo: geoFrame(ctx),
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: false,
      show: !compact,
      orient: "horizontal" as const,
      left: "center",
      bottom: 0,
      inRange: {
        color: [
          config.backgroundColor === "#ffffff" ? PROVINCE_FALLBACK_COLOR : config.backgroundColor,
          colorFor(0, config),
        ],
      },
      textStyle: { color: config.theme.text, fontSize: config.fontSize },
    },
  };
}

/** 流向地图: arc segments between country centroids on the geo background. */
export function buildFlowMapOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { compact = false } = config;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const { parsed } = config;
  const sourceIndex = columnIndex(parsed.headers, config.sourceColumn ?? config.categoryColumn);
  const targetIndex = columnIndex(
    parsed.headers,
    config.targetColumn ??
      parsed.headers.find((header) => header !== (config.sourceColumn ?? config.categoryColumn) && !parsed.numericHeaders.includes(header)) ??
      "",
  );
  const valueIndex = columnIndex(
    parsed.headers,
    config.seriesColumns.find((header) => parsed.numericHeaders.includes(header)) ??
      parsed.numericHeaders[0] ??
      "",
  );
  const maxValue = numericBound(ctx);
  const flows: Array<{ coords: [[number, number], [number, number]]; value: number; name: string }> = [];
  parsed.rows.forEach((row) => {
    const source = COUNTRY_CENTROIDS[row[sourceIndex]?.trim() ?? ""];
    const target = COUNTRY_CENTROIDS[row[targetIndex]?.trim() ?? ""];
    const value = toNumber(row[valueIndex] ?? "");
    if (!source || !target || !Number.isFinite(value)) return;
    flows.push({
      coords: [source, target],
      value: Math.max(1, Math.abs(value)),
      name: `${row[sourceIndex]} → ${row[targetIndex]}`,
    });
  });
  const series: SeriesOption[] = [
    {
      name: "航线",
      type: "lines",
      coordinateSystem: "geo",
      data: flows.map((flow) => ({
        ...flow,
        lineStyle: {
          color: colorFor(0, config),
          width: compact ? 1 : Math.max(1, (flow.value / maxValue) * 4),
          opacity: Math.max(0.15, markOpacity * 0.55),
          curveness: 0.25,
        },
      })),
      lineStyle: {
        color: colorFor(0, config),
        curveness: 0.25,
      },
      // Trail effects are canvas-only; the SVG renderer drops them with a
      // console warning, so they stay off entirely.
      effect: { show: false },
      label: { show: false },
      emphasis: { focus: "self" },
    } as SeriesOption,
  ];
  return { series, geo: geoFrame(ctx) };
}

/** Shared geo background frame (world). */
function geoFrame(ctx: RenderContext) {
  const { config } = ctx;
  const { compact = false, theme } = config;
  return {
    map: "world",
    roam: false,
    top: compact ? "6%" : "12%",
    bottom: compact ? "12%" : "18%",
    left: "6%",
    right: "6%",
    itemStyle: {
      areaColor: config.backgroundColor === "#ffffff" ? PROVINCE_FALLBACK_COLOR : config.backgroundColor,
      borderColor: theme.grid,
    },
    emphasis: { label: { show: false } },
    nameMap: WORLD_NAME_MAP,
    silent: false,
  } as unknown as RendererResult["geo"];
}
