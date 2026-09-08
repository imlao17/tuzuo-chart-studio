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

/** GeoJSON (English) name → the Chinese names used in user data.
 *  Covers 179 states/regions; abbreviations are the Natural Earth
 *  forms used by the world GeoJSON (e.g. "Czech Rep.", "Dem. Rep. Congo").
 */
const WORLD_NAME_MAP: Record<string, string> = {
  "China": "中国",
  "United States of America": "美国",
  "United States": "美国",
  "Japan": "日本",
  "Germany": "德国",
  "India": "印度",
  "United Kingdom": "英国",
  "France": "法国",
  "Brazil": "巴西",
  "Russia": "俄罗斯",
  "Canada": "加拿大",
  "Australia": "澳大利亚",
  "Korea": "韩国",
  "Indonesia": "印度尼西亚",
  "Singapore": "新加坡",
  "Malaysia": "马来西亚",
  "Thailand": "泰国",
  "Vietnam": "越南",
  "Philippines": "菲律宾",
  "South Africa": "南非",
  "Saudi Arabia": "沙特阿拉伯",
  "Mexico": "墨西哥",
  "Argentina": "阿根廷",
  "Italy": "意大利",
  "Spain": "西班牙",
  "Netherlands": "荷兰",
  "Switzerland": "瑞士",
  "Sweden": "瑞典",
  "Norway": "挪威",
  "New Zealand": "新西兰",
  "Egypt": "埃及",
  "Nigeria": "尼日利亚",
  "Kenya": "肯尼亚",
  "Turkey": "土耳其",
  "Pakistan": "巴基斯坦",
  "Bangladesh": "孟加拉国",
  "Chile": "智利",
  "Colombia": "哥伦比亚",
  "Poland": "波兰",
  "Ukraine": "乌克兰",
  "United Arab Emirates": "阿联酋",
  "Israel": "以色列",
  "Iran": "伊朗",
  "Iraq": "伊拉克",
  "Kazakhstan": "哈萨克斯坦",
  "Uzbekistan": "乌兹别克斯坦",
  "Austria": "奥地利",
  "Belgium": "比利时",
  "Denmark": "丹麦",
  "Finland": "芬兰",
  "Greece": "希腊",
  "Ireland": "爱尔兰",
  "Portugal": "葡萄牙",
  "Czech Rep.": "捷克",
  "Hungary": "匈牙利",
  "Romania": "罗马尼亚",
  "Bulgaria": "保加利亚",
  "Croatia": "克罗地亚",
  "Serbia": "塞尔维亚",
  "Slovakia": "斯洛伐克",
  "Slovenia": "斯洛文尼亚",
  "Bosnia and Herz.": "波黑",
  "Albania": "阿尔巴尼亚",
  "Estonia": "爱沙尼亚",
  "Latvia": "拉脱维亚",
  "Lithuania": "立陶宛",
  "Belarus": "白俄罗斯",
  "Moldova": "摩尔多瓦",
  "Iceland": "冰岛",
  "Luxembourg": "卢森堡",
  "Malta": "马耳他",
  "Cyprus": "塞浦路斯",
  "Morocco": "摩洛哥",
  "Algeria": "阿尔及利亚",
  "Tunisia": "突尼斯",
  "Libya": "利比亚",
  "Sudan": "苏丹",
  "S. Sudan": "南苏丹",
  "Ethiopia": "埃塞俄比亚",
  "Ghana": "加纳",
  "Tanzania": "坦桑尼亚",
  "Uganda": "乌干达",
  "Mozambique": "莫桑比克",
  "Zambia": "赞比亚",
  "Zimbabwe": "津巴布韦",
  "Angola": "安哥拉",
  "Namibia": "纳米比亚",
  "Botswana": "博茨瓦纳",
  "Madagascar": "马达加斯加",
  "Senegal": "塞内加尔",
  "Mali": "马里",
  "Niger": "尼日尔",
  "Chad": "乍得",
  "Cameroon": "喀麦隆",
  "Côte d'Ivoire": "科特迪瓦",
  "Burkina Faso": "布基纳法索",
  "Guinea": "几内亚",
  "Congo": "刚果（布）",
  "Dem. Rep. Congo": "刚果（金）",
  "Gabon": "加蓬",
  "Rwanda": "卢旺达",
  "Somalia": "索马里",
  "Afghanistan": "阿富汗",
  "Myanmar": "缅甸",
  "Cambodia": "柬埔寨",
  "Lao PDR": "老挝",
  "Nepal": "尼泊尔",
  "Sri Lanka": "斯里兰卡",
  "Mongolia": "蒙古",
  "North Korea": "朝鲜",
  "Dem. Rep. Korea": "朝鲜",
  "Taiwan": "中国台湾",
  "Papua New Guinea": "巴布亚新几内亚",
  "Fiji": "斐济",
  "Peru": "秘鲁",
  "Venezuela": "委内瑞拉",
  "Ecuador": "厄瓜多尔",
  "Bolivia": "玻利维亚",
  "Paraguay": "巴拉圭",
  "Uruguay": "乌拉圭",
  "Cuba": "古巴",
  "Jamaica": "牙买加",
  "Haiti": "海地",
  "Dominican Rep.": "多米尼加",
  "Guatemala": "危地马拉",
  "Honduras": "洪都拉斯",
  "Nicaragua": "尼加拉瓜",
  "Costa Rica": "哥斯达黎加",
  "Panama": "巴拿马",
  "El Salvador": "萨尔瓦多",
  "Belize": "伯利兹",
  "Qatar": "卡塔尔",
  "Kuwait": "科威特",
  "Oman": "阿曼",
  "Yemen": "也门",
  "Jordan": "约旦",
  "Lebanon": "黎巴嫩",
  "Syria": "叙利亚",
  "Azerbaijan": "阿塞拜疆",
  "Armenia": "亚美尼亚",
  "Georgia": "格鲁吉亚",
  "Turkmenistan": "土库曼斯坦",
  "Kyrgyzstan": "吉尔吉斯斯坦",
  "Tajikistan": "塔吉克斯坦",
  "Brunei": "文莱",
  "Solomon Is.": "所罗门群岛",
  "Greenland": "格陵兰",
  "Puerto Rico": "波多黎各",
  "Palestine": "巴勒斯坦",
  "Macedonia": "北马其顿",
  "Montenegro": "黑山",
  "Swaziland": "斯威士兰",
  "Lesotho": "莱索托",
  "Djibouti": "吉布提",
  "Eritrea": "厄立特里亚",
  "Liberia": "利比里亚",
  "Sierra Leone": "塞拉利昂",
  "Togo": "多哥",
  "Benin": "贝宁",
  "Gambia": "冈比亚",
  "Guinea-Bissau": "几内亚比绍",
  "Mauritania": "毛里塔尼亚",
  "Central African Rep.": "中非",
  "Eq. Guinea": "赤道几内亚",
  "Timor-Leste": "东帝汶",
  "Bhutan": "不丹",
  "Maldives": "马尔代夫",
  "Antigua and Barb.": "安提瓜和巴布达",
  "St. Vin. and Gren.": "圣文森特和格林纳丁斯",
  "Trinidad and Tobago": "特立尼达和多巴哥",
  "Bahamas": "巴哈马",
  "Barbados": "巴巴多斯",
  "Saint Lucia": "圣卢西亚",
  "Cape Verde": "佛得角",
  "São Tomé and Principe": "圣多美和普林西比",
  "Comoros": "科摩罗",
  "Mauritius": "毛里求斯",
  "Seychelles": "塞舌尔",
  "Kiribati": "基里巴斯",
};

/** 中文名 → [lng, lat] centroids for the point-based geo templates. */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  "中国": [104.2, 35.8],
  "丹麦": [9.4, 56.0],
  "乌克兰": [31.2, 48.4],
  "俄罗斯": [96.4, 61.5],
  "加拿大": [-106.3, 56.1],
  "南非": [24.7, -30.6],
  "卡塔尔": [51.2, 25.3],
  "印度": [78.9, 22.0],
  "印度尼西亚": [113.9, -0.8],
  "哥伦比亚": [-73.1, 3.9],
  "土耳其": [35.2, 39.0],
  "埃及": [30.8, 26.8],
  "墨西哥": [-102.5, 23.6],
  "孟加拉国": [90.3, 23.7],
  "尼日利亚": [8.7, 9.1],
  "尼泊尔": [84.1, 28.3],
  "巴基斯坦": [69.3, 30.4],
  "巴西": [-51.9, -10.8],
  "德国": [10.4, 51.2],
  "意大利": [12.6, 42.5],
  "斯里兰卡": [80.7, 7.6],
  "新加坡": [103.8, 1.35],
  "新西兰": [172.8, -41.5],
  "日本": [138.2, 36.2],
  "智利": [-71.0, -32.0],
  "柬埔寨": [104.9, 12.6],
  "沙特阿拉伯": [44.5, 24.1],
  "法国": [2.5, 46.6],
  "波兰": [19.1, 52.1],
  "泰国": [100.9, 15.1],
  "澳大利亚": [134.5, -25.7],
  "爱尔兰": [-8.2, 53.2],
  "瑞典": [16.7, 62.8],
  "秘鲁": [-75.0, -9.2],
  "缅甸": [96.5, 21.2],
  "美国": [-98.5, 39.8],
  "肯尼亚": [37.9, 0.0],
  "芬兰": [26.0, 64.5],
  "英国": [-1.5, 52.6],
  "荷兰": [5.3, 52.1],
  "菲律宾": [121.8, 12.9],
  "蒙古": [103.8, 46.8],
  "西班牙": [-3.7, 40.2],
  "越南": [106.3, 16.6],
  "阿根廷": [-64.0, -34.6],
  "阿联酋": [54.2, 23.9],
  "韩国": [127.8, 36.4],
  "马来西亚": [102.0, 4.2],
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
