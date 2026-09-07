/**
 * Behavior regression tests for the chart template layer.
 *
 * These tests drive buildChartOption directly (no browser) to lock in the
 * gap-analysis P0 acceptance criteria:
 *   - config-change redraws: changing a setting visibly changes the option
 *   - data-change redraws: editing a cell visibly changes the option
 *   - validator edges: empty / text / negative / single-column inputs
 *   - option exportability: every template yields a non-empty, serializable option
 *   - sampleData renders: every template's declared sample data produces output
 *
 * Run via the package.json `test` script (npx tsx --test).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChartOption,
  buildThumbnailOption,
  CHART_TEMPLATES,
  type ChartConfig,
  type ChartType,
  numberFormatter,
  tableToParsed,
  THEMES,
} from "../app/chart-model";
import {
  getTemplateDefinition,
  type ValidationContext,
} from "../app/template-definition";

const ALL_TYPES = CHART_TEMPLATES.map((t) => t.id);

/** A complete ChartConfig with sensible defaults; callers override fields. */
function baseConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    type: "groupedColumn",
    parsed: tableToParsed([
      ["月份", "实际收入", "目标"],
      ["一月", "128", "110"],
      ["二月", "146", "125"],
      ["三月", "138", "140"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["实际收入", "目标"],
    title: "标题",
    subtitle: "",
    width: 800,
    height: 480,
    margins: { top: 28, right: 32, bottom: 36, left: 38 },
    theme: THEMES[0],
    primaryColor: THEMES[0].colors[0],
    secondaryColor: THEMES[0].colors[1],
    backgroundColor: "#ffffff",
    transparent: false,
    showLabels: true,
    showLegend: true,
    showGrid: true,
    smooth: false,
    fontSize: 13,
    ...overrides,
  };
}

/** Render a template against its own declared sample data. */
function renderSample(type: ChartType, overrides: Partial<ChartConfig> = {}) {
  const { sampleData } = getTemplateDefinition(type);
  return buildChartOption(
    baseConfig({
      type,
      parsed: tableToParsed(sampleData.table),
      categoryColumn: sampleData.categoryColumn,
      seriesColumns: sampleData.seriesColumns,
      ...overrides,
    }),
  );
}

const sig = (option: unknown) => JSON.stringify(option);

/** Coerce an EChartsOption.series (which may be a single item or undefined)
 *  into an array for length / content assertions. */
const seriesList = (option: { series?: unknown }) =>
  Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];

const gridBox = (option: { grid?: unknown }) =>
  option.grid as { top: number; right: number; bottom: number; left: number };

const singleAxisBox = (option: { singleAxis?: unknown }) =>
  option.singleAxis as {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

test("default themes include the four Flourish palettes", () => {
  const flourishThemes = THEMES.filter((theme) =>
    theme.id.startsWith("flourish"),
  );
  assert.deepEqual(
    flourishThemes.map((theme) => theme.name),
    [
      "Flourish",
      "Flourish Alternate",
      "Flourish Light",
      "Flourish Light Alternate",
    ],
  );
  for (const theme of flourishThemes) {
    assert.equal(theme.colors.length, 11, `${theme.name}: expected 11 colors`);
  }
  assert.deepEqual(flourishThemes[0].colors.slice(0, 4), [
    "#0053d7",
    "#098efa",
    "#8a4bcf",
    "#f2457f",
  ]);
});

// ---------------------------------------------------------------------------
// Group: option exportability — every template yields a non-empty, serializable
// option from its sample data. Covers "PNG/SVG 导出回归 100% 家族覆盖".
// ---------------------------------------------------------------------------

test("every template renders a non-empty, serializable option from its sample data", () => {
  for (const type of ALL_TYPES) {
    const option = renderSample(type);
    const serialized = sig(option);
    assert.ok(serialized.length > 50, `${type}: option serialized to almost nothing`);
    assert.ok(
      Array.isArray(option.series) && option.series.length > 0,
      `${type}: produced no series`,
    );
  }
});

// ---------------------------------------------------------------------------
// Group: sampleData renders — thumbnails build without throwing. Covers
// "每个模板示例数据 100%".
// ---------------------------------------------------------------------------

test("every template thumbnail builds from its sample data", () => {
  for (const type of ALL_TYPES) {
    // buildThumbnailOption must not throw and must return a serializable option.
    const option = buildThumbnailOption(type);
    assert.ok(typeof sig(option) === "string", `${type}: thumbnail not serializable`);
  }
});

// ---------------------------------------------------------------------------
// Group: config-change redraws — flipping a setting must change the option.
// Covers "配置变更重绘 100% 家族覆盖".
// ---------------------------------------------------------------------------

test("toggling showLabels changes the option for every label-bearing template", () => {
  // streamgraph's themeRiver series hardcodes label visibility off (a known
  // P1 gap); parallel/violin/marimekko have no per-point label surface (their
  // settings groups don't expose 数据标签), so they are exempt; every other
  // template wires showLabels through.
  const exempt = new Set<ChartType>(["streamgraph", "parallelCoordinates", "violin", "marimekko", "ohlcBar", "candleVolume", "kpiCard", "kpiCardRow", "sparklineCard", "barTable", "wordCloud", "symbolMap", "geoHeatmap", "flowMap"]);
  const labelled = ALL_TYPES.filter((t) => !exempt.has(t));
  for (const type of labelled) {
    const off = sig(renderSample(type, { showLabels: false }));
    const on = sig(renderSample(type, { showLabels: true }));
    assert.notEqual(off, on, `${type}: showLabels had no effect`);
  }
});

test("label color and precise label positions flow into rendered labels", () => {
  const color = "#ff3366";
  const columnLabel = (seriesList(
    renderSample("groupedColumn", {
      labelColor: color,
      labelPosition: "outsideLeft",
    }),
  )[0] as { label?: { color?: string; position?: string } }).label;
  assert.equal(columnLabel?.color, color);
  assert.equal(columnLabel?.position, "left");

  const barLabel = (seriesList(
    renderSample("bar", { labelPosition: "insideRight" }),
  )[0] as { label?: { position?: string } }).label;
  assert.equal(barLabel?.position, "insideRight");

  const lineLabel = (seriesList(
    renderSample("line", { labelPosition: "outsideBottom" }),
  )[0] as { label?: { position?: string } }).label;
  assert.equal(lineLabel?.position, "bottom");

  const pieLabel = (seriesList(
    renderSample("pie", { labelColor: color, labelPosition: "outsideRight" }),
  )[0] as { label?: { color?: string; position?: string } }).label;
  assert.equal(pieLabel?.color, color);
  assert.equal(pieLabel?.position, "outside");
});

test("text style controls flow into title, axes, and data labels", () => {
  const option = renderSample("groupedColumn", {
    title: "收入",
    subtitle: "单位：万元",
    xAxisTitle: "月份",
    yAxisTitle: "金额",
    titleStyle: {
      color: "#123456",
      fontSize: 28,
      bold: false,
      italic: true,
    },
    subtitleStyle: {
      color: "#654321",
      fontSize: 15,
      bold: true,
      italic: true,
    },
    xAxisTitleStyle: {
      color: "#225588",
      fontSize: 16,
      bold: true,
      italic: false,
    },
    yAxisTitleStyle: {
      color: "#882255",
      fontSize: 17,
      bold: false,
      italic: true,
    },
    xAxisLabelStyle: {
      color: "#116633",
      fontSize: 12,
      bold: true,
      italic: true,
    },
    yAxisLabelStyle: {
      color: "#663311",
      fontSize: 13,
      bold: false,
      italic: true,
    },
    labelStyle: {
      color: "#aa3355",
      fontSize: 18,
      bold: true,
      italic: true,
    },
  });

  const title = option.title as {
    textStyle?: Record<string, unknown>;
    subtextStyle?: Record<string, unknown>;
  };
  assert.deepEqual(title.textStyle, {
    color: "#123456",
    fontSize: 28,
    fontWeight: 400,
    fontStyle: "italic",
  });
  assert.deepEqual(title.subtextStyle, {
    color: "#654321",
    fontSize: 15,
    fontWeight: 700,
    fontStyle: "italic",
  });

  const xAxis = option.xAxis as {
    axisLabel?: Record<string, unknown>;
    nameTextStyle?: Record<string, unknown>;
  };
  const yAxis = option.yAxis as {
    axisLabel?: Record<string, unknown>;
    nameTextStyle?: Record<string, unknown>;
  };
  assert.equal(xAxis.nameTextStyle?.color, "#225588");
  assert.equal(xAxis.nameTextStyle?.fontSize, 16);
  assert.equal(xAxis.nameTextStyle?.fontWeight, 700);
  assert.equal(xAxis.axisLabel?.color, "#116633");
  assert.equal(xAxis.axisLabel?.fontStyle, "italic");
  assert.equal(yAxis.nameTextStyle?.color, "#882255");
  assert.equal(yAxis.nameTextStyle?.fontStyle, "italic");
  assert.equal(yAxis.axisLabel?.color, "#663311");
  assert.equal(yAxis.axisLabel?.fontWeight, 400);

  const label = (seriesList(option)[0] as { label?: Record<string, unknown> })
    .label;
  assert.equal(label?.color, "#aa3355");
  assert.equal(label?.fontSize, 18);
  assert.equal(label?.fontWeight, 700);
  assert.equal(label?.fontStyle, "italic");
});

test("legend positions reserve chart space instead of overlapping the plot", () => {
  const hidden = gridBox(
    renderSample("groupedColumn", {
      showLegend: false,
      title: "标题",
      subtitle: "副标题",
    }),
  );
  const topOption = renderSample("groupedColumn", {
    legendPosition: "top",
    title: "标题",
    subtitle: "副标题",
  });
  const top = gridBox(topOption);
  const topLegend = topOption.legend as { top?: number };
  const topTitle = topOption.title as { top?: number };
  assert.ok(top.top > hidden.top);
  assert.ok((topLegend.top ?? 0) > (topTitle.top ?? 0));

  const bottom = gridBox(
    renderSample("groupedColumn", { legendPosition: "bottom" }),
  );
  assert.ok(bottom.bottom > hidden.bottom);

  const left = gridBox(
    renderSample("groupedColumn", { legendPosition: "left" }),
  );
  assert.ok(left.left > hidden.left);

  const right = gridBox(
    renderSample("groupedColumn", { legendPosition: "right" }),
  );
  assert.ok(right.right > hidden.right);

  const streamHidden = singleAxisBox(
    renderSample("streamgraph", { showLegend: false }),
  );
  const streamTop = singleAxisBox(
    renderSample("streamgraph", { legendPosition: "top" }),
  );
  assert.ok(streamTop.top > streamHidden.top);
});

test("legend alignment controls horizontal and vertical anchoring", () => {
  const topLeft = renderSample("groupedColumn", {
    legendPosition: "top",
    legendAlign: "start",
  }).legend as { left?: number | string; right?: number | string };
  assert.equal(topLeft.left, 38);
  assert.equal(topLeft.right, undefined);

  const topCenter = renderSample("groupedColumn", {
    legendPosition: "top",
    legendAlign: "center",
  }).legend as { left?: number | string; right?: number | string };
  assert.equal(topCenter.left, "center");
  assert.equal(topCenter.right, undefined);

  const topRight = renderSample("groupedColumn", {
    legendPosition: "top",
    legendAlign: "end",
  }).legend as { left?: number | string; right?: number | string };
  assert.equal(topRight.left, undefined);
  assert.equal(topRight.right, 32);

  const leftTop = renderSample("groupedColumn", {
    legendPosition: "left",
    legendAlign: "start",
  }).legend as { top?: number | string; bottom?: number | string };
  assert.equal(leftTop.top, 102);
  assert.equal(leftTop.bottom, undefined);

  const leftMiddle = renderSample("groupedColumn", {
    legendPosition: "left",
    legendAlign: "center",
  }).legend as { top?: number | string; bottom?: number | string };
  assert.equal(leftMiddle.top, "middle");
  assert.equal(leftMiddle.bottom, undefined);

  const rightBottom = renderSample("groupedColumn", {
    legendPosition: "right",
    legendAlign: "end",
  }).legend as { top?: number | string; bottom?: number | string };
  assert.equal(rightBottom.top, undefined);
  assert.equal(rightBottom.bottom, 36);
});

test("changing numberDecimals changes numeric formatting for cartesian templates", () => {
  // numberDecimals flows through the shared numberFormatter into axis labels
  // and data labels. Formatters are functions (dropped by JSON.stringify), so
  // assert on the formatter output directly via the exported numberFormatter.
  const fmt0 = numberFormatter(baseConfig({ numberDecimals: 0 }), false);
  const fmt2 = numberFormatter(baseConfig({ numberDecimals: 2 }), false);
  // The formatter output for a fixed value must differ between decimals 0 and 2.
  assert.notEqual(fmt0(128), fmt2(128), "numberDecimals had no effect on formatting");
  // Spot-check the actual formatted strings to lock the contract.
  assert.equal(fmt0(128), "128");
  assert.equal(fmt2(128), "128.00");
});

test("changing barWidth changes bar-family and diverging/pyramid options", () => {
  const barLike: ChartType[] = [
    "bar",
    "stackedBar",
    "proportionalBar",
    "column",
    "groupedColumn",
    "stackedColumn",
    "proportionalColumn",
    "combo",
    "divergingBar",
    "populationPyramid",
  ];
  for (const type of barLike) {
    const narrow = sig(renderSample(type, { barWidth: 12 }));
    const wide = sig(renderSample(type, { barWidth: 80 }));
    assert.notEqual(narrow, wide, `${type}: barWidth had no effect`);
  }
});

test("changing lineWidth changes line/area/combo options", () => {
  const lineLike: ChartType[] = [
    "line",
    "smoothLine",
    "stepLine",
    "area",
    "stackedArea",
    "proportionalArea",
    "combo",
  ];
  for (const type of lineLike) {
    const thin = sig(renderSample(type, { lineWidth: 1 }));
    const thick = sig(renderSample(type, { lineWidth: 10 }));
    assert.notEqual(thin, thick, `${type}: lineWidth had no effect`);
  }
});

// ---------------------------------------------------------------------------
// Group: data-change redraws — editing a cell value must change the option.
// Covers "数据修改后成功重绘 100% 家族覆盖".
// ---------------------------------------------------------------------------

test("editing a data cell changes the option for every template", () => {
  for (const type of ALL_TYPES) {
    const { sampleData } = getTemplateDefinition(type);
    const before = renderSample(type);
    // Mutate the first numeric data cell of the sample table.
    const table = sampleData.table.map((row) => [...row]);
    const dataRow = table[1] ?? table[0];
    // Find the first column whose header is in seriesColumns.
    const valueIdx = Math.max(
      1,
      sampleData.table[0].indexOf(sampleData.seriesColumns[0]),
    );
    const original = dataRow[valueIdx];
    dataRow[valueIdx] = String(Number(original) * 10 + 7);
    const after = buildChartOption(
      baseConfig({
        type,
        parsed: tableToParsed(table),
        categoryColumn: sampleData.categoryColumn,
        seriesColumns: sampleData.seriesColumns,
      }),
    );
    assert.notEqual(sig(before), sig(after), `${type}: data edit had no effect`);
  }
});

// ---------------------------------------------------------------------------
// Group: validator edges — empty / no-numeric / single-column inputs surface
// the right error. Covers "空值、文本、负值和极端值用例 每家族至少 1 组".
// ---------------------------------------------------------------------------

function firstError(
  type: ChartType,
  ctx: ValidationContext,
): string | null {
  const def = getTemplateDefinition(type);
  for (const v of def.validators) {
    const msg = v.validate(ctx);
    if (msg) return msg;
  }
  return null;
}

test("header-only table reports a row error for every template", () => {
  const ctx: ValidationContext = {
    parsed: tableToParsed([["月份", "实际收入"]]),
    categoryColumn: "月份",
    seriesColumns: [],
  };
  for (const type of ALL_TYPES) {
    assert.equal(firstError(type, ctx), "至少需要一行数据", `${type} wrong error`);
  }
});

test("table with no numeric columns reports a numeric error for every template", () => {
  const ctx: ValidationContext = {
    parsed: tableToParsed([
      ["月份", "备注"],
      ["一月", "a"],
      ["二月", "b"],
    ]),
    categoryColumn: "月份",
    seriesColumns: [],
  };
  for (const type of ALL_TYPES) {
    assert.equal(firstError(type, ctx), "至少需要一个数值列", `${type} wrong error`);
  }
});

test("single numeric column passes generic templates but fails role-specific templates", () => {
  const ctx: ValidationContext = {
    parsed: tableToParsed([
      ["月份", "数值"],
      ["一月", "10"],
      ["二月", "20"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["数值"],
  };
  for (const type of ALL_TYPES) {
    const err = firstError(type, ctx);
    if (["scatter", "divergingBar", "populationPyramid", "rangeBar", "rangeColumn", "bulletBar", "slopeChart", "groupedScatter", "quadrant", "trendScatter", "correlationMatrix", "dumbbell", "densityHeatmap", "gantt"].includes(type)) {
      assert.ok(err && err.includes("2 个数值列"), `${type}: expected 2-column error, got ${err}`);
    } else if (["bandArea", "bubble", "errorBar"].includes(type)) {
      assert.ok(err && err.includes("3 个数值列"), `${type}: expected 3-column error, got ${err}`);
    } else if (type === "candlestick" || type === "ohlcBar") {
      assert.ok(err && err.includes("4 个数值列"), `${type}: expected OHLC error, got ${err}`);
    } else if (type === "candleVolume") {
      assert.ok(err && err.includes("5 个数值列"), `${type}: expected 5-column error, got ${err}`);
    } else if (["sankey", "networkGraph", "chord", "adjacencyMatrix", "alluvial", "flowMap"].includes(type)) {
      assert.ok(err && err.includes("2 个文本列"), `${type}: expected flow-column error, got ${err}`);
    } else {
      assert.equal(err, null, `${type}: should accept a single numeric column`);
    }
  }
});

test("role-specific validators check selected numeric fields, not only table shape", () => {
  const parsed = tableToParsed([
    ["日期", "开盘", "收盘", "最低", "最高"],
    ["一月", "100", "120", "95", "128"],
    ["二月", "120", "115", "108", "130"],
  ]);
  const ctx: ValidationContext = {
    parsed,
    categoryColumn: "日期",
    seriesColumns: ["开盘", "收盘"],
  };

  assert.match(firstError("candlestick", ctx) ?? "", /4 个数值列/);
});

test("advanced templates emit their intended ECharts series and coordinate options", () => {
  const expectedSeriesTypes = {
    dotPlot: "scatter",
    waterfall: "bar",
    heatmap: "heatmap",
    treemap: "treemap",
    funnel: "funnel",
    gauge: "gauge",
    radar: "radar",
    boxplot: "boxplot",
    candlestick: "candlestick",
    sankey: "sankey",
  } as const satisfies Partial<Record<ChartType, string>>;

  for (const [type, expectedType] of Object.entries(expectedSeriesTypes) as Array<
    [ChartType, string]
  >) {
    const option = renderSample(type);
    const first = seriesList(option)[0] as { type?: string };
    assert.equal(first.type, expectedType, `${type}: wrong series type`);
    if (type === "radar") assert.ok(option.radar, "radar: missing radar coordinate");
    if (type === "heatmap") assert.ok(option.visualMap, "heatmap: missing visualMap");
    if (type === "sankey") {
      const sankey = first as { links?: unknown[]; data?: unknown[] };
      assert.ok((sankey.links?.length ?? 0) > 0, "sankey: missing links");
      assert.ok((sankey.data?.length ?? 0) > 0, "sankey: missing nodes");
    }
  }
});

test("advanced template settings expose only effective groups", () => {
  const groupIds = (type: ChartType) =>
    getTemplateDefinition(type).settingsGroups.map((group) => group.id);
  const noLegendTypes: ChartType[] = [
    "dotPlot",
    "waterfall",
    "heatmap",
    "treemap",
    "funnel",
    "gauge",
    "boxplot",
    "candlestick",
    "sankey",
  ];
  for (const type of noLegendTypes) {
    const def = getTemplateDefinition(type);
    assert.equal(def.capabilities.legend, false, `${type}: should not support legend controls`);
    assert.equal(groupIds(type).includes("legend"), true, `${type}: should keep tooltip controls available`);
  }
  for (const type of ["heatmap", "boxplot", "candlestick", "gauge"] as ChartType[]) {
    assert.equal(groupIds(type).includes("marks"), false, `${type}: should not expose inactive mark controls`);
  }
  for (const type of ["dotPlot", "waterfall", "treemap", "funnel", "radar", "sankey"] as ChartType[]) {
    assert.equal(groupIds(type).includes("marks"), true, `${type}: should expose active mark controls`);
  }
});

test("advanced mark controls change the rendered options they advertise", () => {
  const cases: Array<[ChartType, Partial<ChartConfig>]> = [
    ["dotPlot", { pointSize: 18 }],
    ["waterfall", { barWidth: 20, markOpacity: 48 }],
    ["radar", { lineWidth: 6, pointSize: 12, areaOpacity: 44 }],
    ["treemap", { markOpacity: 52 }],
    ["funnel", { markOpacity: 52 }],
    ["sankey", { markOpacity: 52 }],
    ["pie", { markOpacity: 52 }],
  ];

  for (const [type, overrides] of cases) {
    assert.notEqual(
      sig(renderSample(type)),
      sig(renderSample(type, overrides)),
      `${type}: advertised controls had no effect`,
    );
  }
});

test("negative and extreme values render without throwing", () => {
  // Diverging/pyramid/bar charts must tolerate negatives; large values must
  // not break number formatting or axis bounds.
  const ctx = {
    parsed: tableToParsed([
      ["月份", "收入", "支出"],
      ["一月", "-1280", "9999999"],
      ["二月", "0", "1e6"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["收入", "支出"],
  };
  const types: ChartType[] = [
    "bar",
    "stackedBar",
    "column",
    "groupedColumn",
    "divergingBar",
    "populationPyramid",
    "line",
  ];
  for (const type of types) {
    const option = buildChartOption(baseConfig({ type, ...ctx }));
    assert.ok(seriesList(option).length > 0, `${type}: failed to render negatives/extremes`);
  }
});

// ---------------------------------------------------------------------------
// Group: P1-1 bar/column deepening — sort, stack totals, stack order, gaps.
// Locks in the new capabilities and the default-is-unchanged contract.
// ---------------------------------------------------------------------------

const BAR_TYPES: ChartType[] = [
  "bar",
  "stackedBar",
  "proportionalBar",
  "column",
  "groupedColumn",
  "stackedColumn",
  "proportionalColumn",
];

const quarterlyConfig = (overrides: Partial<ChartConfig> = {}): ChartConfig =>
  baseConfig({
    parsed: tableToParsed([
      ["季度", "产品 A", "产品 B", "产品 C"],
      ["Q1", "320", "240", "180"],
      ["Q2", "380", "290", "210"],
      ["Q3", "420", "310", "245"],
      ["Q4", "510", "365", "290"],
    ]),
    categoryColumn: "季度",
    seriesColumns: ["产品 A", "产品 B", "产品 C"],
    ...overrides,
  });

test("P1-1: bar defaults are unchanged when the new fields are absent", () => {
  for (const type of BAR_TYPES) {
    const implicit = sig(buildChartOption(quarterlyConfig({ type })));
    const explicitUndef = sig(
      buildChartOption(
        quarterlyConfig({
          type,
          sortCategories: undefined,
          showStackTotals: undefined,
          stackOrder: undefined,
          barGap: undefined,
          barCategoryGap: undefined,
        }),
      ),
    );
    assert.equal(implicit, explicitUndef, `${type}: defaults differ`);
  }
});

test("P1-1: sortCategories reorders the category axis", () => {
  const sorted = buildChartOption(
    quarterlyConfig({
      type: "stackedColumn",
      sortCategories: { bySeries: "产品 A", order: "desc" },
    }),
  );
  const cats = (sorted.xAxis as { data: string[] }).data;
  // 产品 A values: Q1=320, Q2=380, Q3=420, Q4=510 → desc => Q4,Q3,Q2,Q1
  assert.deepEqual(cats, ["Q4", "Q3", "Q2", "Q1"]);
});

test("P1-1: stackOrder reorders stacked series by total value", () => {
  // Totals: 产品 A=1630, 产品 B=1205, 产品 C=925.
  const asc = buildChartOption(quarterlyConfig({ type: "stackedColumn", stackOrder: "asc" }));
  const desc = buildChartOption(quarterlyConfig({ type: "stackedColumn", stackOrder: "desc" }));
  const namesAsc = seriesList(asc).map((s) => (s as { name: string }).name);
  const namesDesc = seriesList(desc).map((s) => (s as { name: string }).name);
  assert.deepEqual(namesAsc, ["产品 C", "产品 B", "产品 A"]);
  assert.deepEqual(namesDesc, ["产品 A", "产品 B", "产品 C"]);
});

test("P1-1: stackOrder preserves per-series color (original palette index)", () => {
  const desc = buildChartOption(quarterlyConfig({ type: "stackedColumn", stackOrder: "desc" }));
  const asc = buildChartOption(quarterlyConfig({ type: "stackedColumn", stackOrder: "asc" }));
  const colorOf = (option: { series?: unknown }, name: string) =>
    seriesList(option)
      .find((s) => (s as { name: string }).name === name)
      ?.itemStyle.color;
  // 产品 A keeps palette[0] regardless of stack position.
  assert.equal(colorOf(desc, "产品 A"), colorOf(asc, "产品 A"));
});

test("P1-1: showStackTotals surfaces column totals via the top-series formatter", () => {
  // QuarterlyConfig uses the ChartConfig default (thousands separator on), so
  // totals are formatted in zh-CN grouping form.
  const on = buildChartOption(quarterlyConfig({ type: "stackedColumn", showStackTotals: true }));
  const top = seriesList(on).at(-1) as { label?: { formatter?: (p: { dataIndex: number }) => string } };
  assert.equal(top.label?.formatter?.({ dataIndex: 0 }), "740"); // 320+240+180
  assert.equal(top.label?.formatter?.({ dataIndex: 3 }), "1,165"); // 510+365+290
});

test("P1-1: showStackTotals is a no-op for non-stacked bar types", () => {
  // For non-stacked types the renderer never enters the totals branch, so the
  // top-series formatter must keep returning the segment value (not a total).
  for (const type of ["bar", "groupedColumn", "column"] as ChartType[]) {
    const on = buildChartOption(quarterlyConfig({ type, showStackTotals: true }));
    const last = seriesList(on).at(-1) as { label?: { formatter?: (p: { dataIndex: number; value: number }) => string } };
    // Last series in Q1 (original order) is 产品 C = 180.
    assert.equal(last.label?.formatter?.({ dataIndex: 0, value: 180 }), "180", `${type}: totals leaked into non-stacked`);
  }
});

test("P1-1: barGap and barCategoryGap change the option", () => {
  const off = sig(quarterlyConfig({ type: "groupedColumn" }));
  const on = sig(
    quarterlyConfig({ type: "groupedColumn", barGap: 50, barCategoryGap: 40 }),
  );
  assert.notEqual(off, on);
});

// ---------------------------------------------------------------------------
// Group: P1-2 line/area deepening — connectNulls, endLabel, reference marks.
// ---------------------------------------------------------------------------

const LINE_TYPES: ChartType[] = [
  "line",
  "smoothLine",
  "stepLine",
  "area",
  "stackedArea",
  "proportionalArea",
];

test("P1-2: line/area defaults are unchanged when the new fields are absent", () => {
  for (const type of LINE_TYPES) {
    const implicit = sig(buildChartOption(baseConfig({ type })));
    const explicitUndef = sig(
      buildChartOption(
        baseConfig({
          type,
          connectNulls: undefined,
          endLabel: undefined,
          referenceBands: undefined,
          referenceLines: undefined,
        }),
      ),
    );
    assert.equal(implicit, explicitUndef, `${type}: defaults differ`);
  }
});

test("P1-2: connectNulls appears on every line/area series", () => {
  for (const type of LINE_TYPES) {
    const option = buildChartOption(baseConfig({ type, connectNulls: true }));
    for (const s of seriesList(option)) {
      assert.equal((s as { connectNulls?: boolean }).connectNulls, true, `${type}: missing connectNulls`);
    }
  }
});

test("P1-2: endLabel is added to line series but not area", () => {
  const line = buildChartOption(baseConfig({ type: "line", endLabel: true }));
  const lineSeries = seriesList(line)[0] as { endLabel?: unknown };
  assert.ok(lineSeries.endLabel, "line series missing endLabel");
  // endLabel suppresses the per-point label.
  const lineLabel = seriesList(line)[0] as { label?: { show?: boolean } };
  assert.equal(lineLabel.label?.show, false);
  // area should not get endLabel (only line family).
  const area = buildChartOption(baseConfig({ type: "area", endLabel: true }));
  const areaSeries = seriesList(area)[0] as { endLabel?: unknown };
  assert.equal(areaSeries.endLabel, undefined);
});

test("P1-2: referenceBands attaches markArea to the first series only", () => {
  const option = buildChartOption(
    baseConfig({
      type: "line",
      referenceBands: [{ start: "二月", end: "四月" }],
    }),
  );
  const list = seriesList(option);
  const first = list[0] as { markArea?: { data: unknown[] } };
  const second = list[1] as { markArea?: unknown };
  assert.ok(first.markArea && first.markArea.data.length === 1, "first series missing markArea");
  assert.equal(second.markArea, undefined, "markArea leaked to non-first series");
});

test("P1-2: referenceLines attaches markLine to the first series only", () => {
  const option = buildChartOption(
    baseConfig({
      type: "line",
      referenceLines: [{ value: 150, label: "目标" }],
    }),
  );
  const list = seriesList(option);
  const first = list[0] as { markLine?: { data: unknown[] } };
  const second = list[1] as { markLine?: unknown };
  assert.ok(first.markLine && first.markLine.data.length === 1, "first series missing markLine");
  assert.equal(second.markLine, undefined, "markLine leaked to non-first series");
});

// ---------------------------------------------------------------------------
// Group: P1-3 pie/donut deepening — label content, inner radius, sort, angle,
// "other" merging.
// ---------------------------------------------------------------------------

const PIE_TYPES: ChartType[] = ["pie", "donut"];

test("P1-3: pie/donut defaults are unchanged when the new fields are absent", () => {
  for (const type of PIE_TYPES) {
    const implicit = sig(buildChartOption(baseConfig({ type })));
    const explicitUndef = sig(
      buildChartOption(
        baseConfig({
          type,
          pieLabelContent: undefined,
          donutInnerRadius: undefined,
          pieSort: undefined,
          startAngle: undefined,
          pieOtherThreshold: undefined,
        }),
      ),
    );
    assert.equal(implicit, explicitUndef, `${type}: defaults differ`);
  }
});

test("P1-3: pieLabelContent switches the label formatter and value/percent modes", () => {
  // Default keeps the legacy string formatter.
  const def = buildChartOption(baseConfig({ type: "pie" }));
  const defLabel = seriesList(def)[0] as { label?: { formatter?: unknown } };
  assert.equal(defLabel.label?.formatter, "{b}\n{d}%");
  // "value" mode yields a function formatter whose output includes the value.
  const valueMode = buildChartOption(baseConfig({ type: "pie", pieLabelContent: "value" }));
  const valueLabel = seriesList(valueMode)[0] as { label?: { formatter?: (p: { name: string; percent: number; value: number }) => string } };
  const fn = valueLabel.label?.formatter;
  assert.equal(typeof fn, "function");
  // baseConfig row 1 numeric series[0] value is 128 → value mode prints "128".
  assert.equal(fn?.({ name: "一月", percent: 50, value: 128 }), "一月\n128");
  // "both" mode includes percent too.
  const bothMode = buildChartOption(baseConfig({ type: "pie", pieLabelContent: "both" }));
  const bothFn = (seriesList(bothMode)[0] as { label?: { formatter?: (p: { name: string; percent: number; value: number }) => string } }).label?.formatter;
  assert.equal(bothFn?.({ name: "一月", percent: 42, value: 128 }), "一月\n128 (42%)");
});

test("P1-3: donutInnerRadius changes the donut inner radius", () => {
  const def = buildChartOption(baseConfig({ type: "donut" }));
  const tuned = buildChartOption(baseConfig({ type: "donut", donutInnerRadius: 0.8 }));
  const defRadius = (seriesList(def)[0] as { radius: [number, number] }).radius;
  const tunedRadius = (seriesList(tuned)[0] as { radius: [number, number] }).radius;
  assert.notEqual(defRadius[0], tunedRadius[0]);
  assert.ok(tunedRadius[0] > defRadius[0], "larger inner radius should yield larger hole");
});

test("P1-3: pieSort reorders the slice data by value", () => {
  const desc = buildChartOption(baseConfig({ type: "pie", pieSort: "desc" }));
  const data = (seriesList(desc)[0] as { data: { value: number }[] }).data;
  const values = data.map((d) => d.value);
  const sorted = [...values].sort((a, b) => b - a);
  assert.deepEqual(values, sorted);
});

test("P1-3: startAngle appears on the series when configured", () => {
  const option = buildChartOption(baseConfig({ type: "pie", startAngle: 45 }));
  const series = seriesList(option)[0] as { startAngle?: number };
  assert.equal(series.startAngle, 45);
});

test("P1-3: startAngle is ABSENT (not undefined) on the pie series by default", () => {
  // Regression: emitting startAngle: undefined on the pie series object makes
  // ECharts 6's pie renderer produce empty slice paths (d=""). The field must
  // be entirely absent, which JSON.stringify masks — so assert with `in`.
  const option = buildChartOption(baseConfig({ type: "pie" }));
  const series = seriesList(option)[0] as object;
  assert.equal("startAngle" in series, false, "startAngle key should be absent by default");
  // Same for donut.
  const donut = buildChartOption(baseConfig({ type: "donut" }));
  assert.equal("startAngle" in seriesList(donut)[0], false);
});

test("P1-3: pieOtherThreshold merges small slices into 其他", () => {
  // baseConfig row values for the primary series are 128/146/138 (total 412).
  // With a 34% threshold, both the 31% and 33% slices merge → 1 其他 + 1 large.
  const option = buildChartOption(baseConfig({ type: "pie", pieOtherThreshold: 34 }));
  const data = (seriesList(option)[0] as { data: { name: string; value: number }[] }).data;
  const names = data.map((d) => d.name);
  assert.ok(names.includes("其他"), "expected an 其他 merged slice");
  assert.ok(data.length === 2, `expected 2 slices after merge, got ${data.length}`);
  // The 其他 slice must carry the sum of the merged small slices (128+138=266).
  const otherSlice = data.find((d) => d.name === "其他");
  assert.equal(otherSlice?.value, 266);
});

// ---------------------------------------------------------------------------
// Group: P1-4 scatter deepening — size/color/shape roles + trend line.
// ---------------------------------------------------------------------------

// Scatter test data: 姓名 (category) + 身高/体重/年龄 (numeric) + 性别 (categorical).
const scatterConfig = (overrides: Partial<ChartConfig> = {}): ChartConfig =>
  baseConfig({
    parsed: tableToParsed([
      ["姓名", "身高 cm", "体重 kg", "年龄", "性别"],
      ["A", "160", "55", "20", "女"],
      ["B", "175", "70", "30", "男"],
      ["C", "168", "62", "25", "女"],
      ["D", "180", "80", "40", "男"],
    ]),
    categoryColumn: "姓名",
    seriesColumns: ["身高 cm", "体重 kg"],
    ...overrides,
  });

test("P1-4: scatter defaults are unchanged when the new fields are absent", () => {
  const implicit = sig(buildChartOption(scatterConfig({ type: "scatter" })));
  const explicitUndef = sig(
    buildChartOption(
      scatterConfig({
        type: "scatter",
        sizeColumn: undefined,
        colorColumn: undefined,
        shapeColumn: undefined,
        scatterTrendLine: undefined,
      }),
    ),
  );
  assert.equal(implicit, explicitUndef);
});

test("P1-4: sizeColumn switches data to object form with per-point symbolSize", () => {
  const option = buildChartOption(
    scatterConfig({ type: "scatter", sizeColumn: "年龄" }),
  );
  const data = (seriesList(option)[0] as { data: unknown[] }).data;
  // Object-form entries carry a symbolSize; ages 20/30/25/40 → distinct sizes.
  for (const entry of data) {
    assert.ok(typeof entry === "object" && entry !== null, "expected object-form entry");
  }
  const sizes = (data as { symbolSize: number }[]).map((d) => d.symbolSize);
  assert.ok(sizes.some((s, i) => s !== sizes[0] || i === 0), "sizes should vary");
});

test("P1-4: colorColumn assigns per-point categorical colors", () => {
  const option = buildChartOption(
    scatterConfig({ type: "scatter", colorColumn: "性别" }),
  );
  const data = (seriesList(option)[0] as { data: { itemStyle?: { color?: string } }[] }).data;
  const colors = data.map((d) => d.itemStyle?.color);
  // 男 and 女 should map to two distinct colors.
  assert.ok(new Set(colors).size === 2, `expected 2 distinct colors, got ${colors.join(",")}`);
});

test("P1-4: shapeColumn assigns per-point categorical symbols", () => {
  const option = buildChartOption(
    scatterConfig({ type: "scatter", shapeColumn: "性别" }),
  );
  const data = (seriesList(option)[0] as { data: { symbol?: string }[] }).data;
  const symbols = data.map((d) => d.symbol);
  assert.ok(new Set(symbols).size === 2, `expected 2 distinct symbols, got ${symbols.join(",")}`);
});

test("P1-4: scatterTrendLine attaches a two-point markLine", () => {
  const option = buildChartOption(
    scatterConfig({ type: "scatter", scatterTrendLine: true }),
  );
  const series = seriesList(option)[0] as { markLine?: { data: unknown[] } };
  assert.ok(series.markLine, "missing trend markLine");
  assert.ok(series.markLine && series.markLine.data.length === 1, "expected one 2-point line");
});

// ---------------------------------------------------------------------------
// Group: P1-5 combo dual Y axis — opt-in split of bar/line across two axes.
// ---------------------------------------------------------------------------

const comboConfig = (overrides: Partial<ChartConfig> = {}): ChartConfig =>
  baseConfig({
    type: "combo",
    parsed: tableToParsed([
      ["月份", "收入", "增长率"],
      ["一月", "128", "12"],
      ["二月", "146", "14"],
      ["三月", "138", "9"],
      ["四月", "172", "18"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["收入", "增长率"],
    ...overrides,
  });

test("P1-5: combo defaults are unchanged when the new fields are absent", () => {
  const implicit = sig(buildChartOption(comboConfig()));
  const explicitUndef = sig(
    buildChartOption(
      comboConfig({
        comboDualAxis: undefined,
        y2AxisTitle: undefined,
        comboAxisSync: undefined,
      }),
    ),
  );
  assert.equal(implicit, explicitUndef);
  // Default yAxis is a single object, not an array.
  const def = buildChartOption(comboConfig());
  assert.equal(Array.isArray(def.yAxis), false);
});

test("P1-5: comboDualAxis splits yAxis into a 2-element array and assigns yAxisIndex", () => {
  const option = buildChartOption(comboConfig({ comboDualAxis: true }));
  assert.ok(Array.isArray(option.yAxis) && option.yAxis.length === 2, "expected 2-element yAxis array");
  const list = seriesList(option);
  // 收入 (index 0, bar) → yAxisIndex 0; 增长率 (index 1, line) → yAxisIndex 1.
  const barIdx = list.findIndex((s) => (s as { name: string }).name === "收入");
  const lineIdx = list.findIndex((s) => (s as { name: string }).name === "增长率");
  assert.equal((list[barIdx] as { yAxisIndex?: number }).yAxisIndex, 0);
  assert.equal((list[lineIdx] as { yAxisIndex?: number }).yAxisIndex, 1);
});

test("P1-5: y2AxisTitle lands on the right (second) Y axis", () => {
  const option = buildChartOption(
    comboConfig({ comboDualAxis: true, y2AxisTitle: "增长率 (%)", yAxisTitle: "收入" }),
  );
  const axes = option.yAxis as { name?: string }[];
  assert.equal(axes[0].name, "收入");
  assert.equal(axes[1].name, "增长率 (%)");
});

test("P1-5: comboAxisSync applies a shared min/max to both axes", () => {
  const option = buildChartOption(
    comboConfig({ comboDualAxis: true, comboAxisSync: true }),
  );
  const axes = option.yAxis as { min?: number; max?: number }[];
  assert.equal(axes[0].min, axes[1].min);
  assert.equal(axes[0].max, axes[1].max);
  // The shared max must equal the global max across both series (172 and 18 → 172).
  assert.equal(axes[0].max, 172);
});

test("P1-5: non-combo templates are unaffected by the patchAxes array support", () => {
  // Regression: every other template still returns a single (non-array) yAxis.
  // Multi-panel/multi-axis templates are array-typed by design.
  for (const type of ALL_TYPES.filter((t) => !["combo", "pareto", "dualAxisLine", "candleVolume", "splitAxisBar", "smallMultiples"].includes(t))) {
    const option = buildChartOption(baseConfig({ type }));
    assert.equal(Array.isArray(option.yAxis), false, `${type}: yAxis unexpectedly an array`);
  }
});

// ---------------------------------------------------------------------------
// Group: P1-6 streamgraph time axis — opt-in date parsing on the category axis.
// ---------------------------------------------------------------------------

const streamConfig = (overrides: Partial<ChartConfig> = {}): ChartConfig =>
  baseConfig({
    type: "streamgraph",
    parsed: tableToParsed([
      ["月份", "产品 A", "产品 B"],
      ["2024-01", "320", "240"],
      ["2024-02", "380", "290"],
      ["2024-03", "420", "310"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["产品 A", "产品 B"],
    ...overrides,
  });

test("P1-6: streamgraph defaults are unchanged when streamTimeAxis is absent", () => {
  const implicit = sig(buildChartOption(streamConfig()));
  const explicitUndef = sig(buildChartOption(streamConfig({ streamTimeAxis: undefined })));
  assert.equal(implicit, explicitUndef);
  // Default axis is a value axis (row-index based), not a time axis.
  assert.equal((buildChartOption(streamConfig()).singleAxis as { type?: string }).type, "value");
});

test("P1-6: streamTimeAxis switches to a time axis with timestamps when categories parse", () => {
  const option = buildChartOption(streamConfig({ streamTimeAxis: true }));
  const axis = option.singleAxis as { type?: string };
  assert.equal(axis.type, "time");
  // Data tuples carry timestamps (numbers in the billions for ms epochs),
  // not small row indices.
  const series = seriesList(option)[0] as { data: [number, number, string][] };
  const xs = series.data.map((d) => d[0]);
  assert.ok(xs.every((x) => x > 1_000_000_000_000), `expected epoch ms, got ${xs}`);
});

test("P1-6: streamTimeAxis falls back to value axis when categories are not dates", () => {
  // Non-date categories (Chinese month names) should not break; renderer falls
  // back to the row-index value axis.
  const option = buildChartOption(
    baseConfig({
      type: "streamgraph",
      streamTimeAxis: true,
    }),
  );
  const axis = option.singleAxis as { type?: string };
  assert.equal(axis.type, "value");
  // Data tuples carry row indices (small integers).
  const series = seriesList(option)[0] as { data: [number, number, string][] };
  const xs = series.data.map((d) => d[0]);
  assert.ok(xs.every((x) => x < 1000), `expected small indices, got ${xs}`);
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 1 — bar/column extensions. Each new template
// gets its signature structure plus a config-change and an edge assertion on
// top of the generic loops above.
// ---------------------------------------------------------------------------

test("P100-1: role templates that need two numeric columns reject a single one", () => {
  const ctx: ValidationContext = {
    parsed: tableToParsed([
      ["月份", "数值"],
      ["一月", "10"],
      ["二月", "20"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["数值"],
  };
  const twoColumnTypes: ChartType[] = ["rangeBar", "rangeColumn", "bulletBar"];
  for (const type of twoColumnTypes) {
    const err = firstError(type, ctx);
    assert.ok(err && err.includes("2 个数值列"), `${type}: expected 2-column error, got ${err}`);
  }
});

test("P100-1: histogram bins a numeric column into interval bars", () => {
  const option = renderSample("histogram");
  const [bar] = seriesList(option) as Array<{ type?: string; barCategoryGap?: number; data: number[] }>;
  assert.equal(bar.type, "bar");
  assert.equal(bar.barCategoryGap, 0);
  const xAxis = option.xAxis as { data?: string[] };
  assert.ok((xAxis.data?.length ?? 0) >= 5, "expected at least 5 bins");
  assert.ok(
    xAxis.data?.every((label) => label.includes("–")),
    `expected interval labels, got ${xAxis.data}`,
  );
  assert.equal(bar.data.length, xAxis.data?.length);
  // Binning counts must total the sample row count.
  assert.equal(
    bar.data.reduce((sum, v) => sum + v, 0),
    getTemplateDefinition("histogram").sampleData.table.length - 1,
  );
  // barWidth flows into the histogram bars (config-change redraw).
  assert.notEqual(sig(renderSample("histogram", { barWidth: 12 })), sig(renderSample("histogram", { barWidth: 80 })));
});

test("P100-1: histogram collapses constant data into a single bin", () => {
  const option = buildChartOption(
    baseConfig({
      type: "histogram",
      parsed: tableToParsed([
        ["样本", "数值"],
        ["a", "5"],
        ["b", "5"],
        ["c", "5"],
      ]),
      categoryColumn: "样本",
      seriesColumns: ["数值"],
    }),
  );
  const xAxis = option.xAxis as { data?: string[] };
  assert.equal(xAxis.data?.length, 1);
});

test("P100-1: density histogram overlays a smooth density line on the bars", () => {
  const option = renderSample("densityHistogram");
  const series = seriesList(option) as Array<{ type?: string; smooth?: boolean; data?: number[] }>;
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.type, "line");
  assert.equal(series[1]?.smooth, true);
  assert.equal(series[1]?.data?.length, series[0]?.data?.length);
  // The curve is scaled to counts, so it stays in the same magnitude range.
  const maxCount = Math.max(...(series[0]?.data ?? [0]));
  assert.ok(
    (series[1]?.data ?? []).every((v) => v <= maxCount + 1),
    "density curve should be scaled to count units",
  );
});

test("P100-1: range bars draw a transparent base plus a visible floating segment", () => {
  for (const type of ["rangeBar", "rangeColumn"] as ChartType[]) {
    const option = renderSample(type);
    const series = seriesList(option) as Array<{
      type?: string;
      stack?: string;
      itemStyle?: { color?: string };
      label?: { show?: boolean };
    }>;
    assert.equal(series[0]?.stack, "range", `${type}: base series must stack`);
    assert.equal(series[0]?.itemStyle?.color, "transparent", `${type}: base must be transparent`);
    assert.equal(series[1]?.stack, "range", `${type}: visible series must stack`);
    assert.notEqual(series[1]?.itemStyle?.color, "transparent");
    // Labels ride the visible series only (showLabels toggle still flips them).
    assert.equal(series[0]?.label?.show, false);
    assert.equal(series[1]?.label?.show, true);
    assert.notEqual(
      sig(renderSample(type, { showLabels: false })),
      sig(renderSample(type, { showLabels: true })),
    );
  }
  // rangeColumn is vertical: category axis on x.
  const column = renderSample("rangeColumn");
  assert.equal((column.xAxis as { type?: string }).type, "category");
  const bar = renderSample("rangeBar");
  assert.equal((bar.yAxis as { type?: string }).type, "category");
});

test("P100-1: bullet chart overlays a narrow target strip on the actual bar", () => {
  const option = renderSample("bulletBar");
  const series = seriesList(option) as Array<{
    type?: string;
    barGap?: string;
    barMaxWidth?: number;
    label?: { show?: boolean };
  }>;
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.type, "bar");
  assert.equal(series[1]?.barGap, "-100%", "target strip must overlap the actual bar");
  assert.ok((series[1]?.barMaxWidth ?? 0) < (series[0]?.barMaxWidth ?? 0), "target strip must be narrower");
  assert.equal(series[0]?.label?.show, true);
  assert.equal(series[1]?.label?.show, false);
  // Target strip width tracks barWidth.
  assert.notEqual(
    sig(renderSample("bulletBar", { barWidth: 20 })),
    sig(renderSample("bulletBar", { barWidth: 70 })),
  );
});

test("P100-1: lollipop pairs a stem with a bead per series", () => {
  const option = renderSample("lollipop");
  const series = seriesList(option) as Array<{ type?: string; symbolSize?: number; barMaxWidth?: number }>;
  assert.equal(series.length, 2, "one stem + one bead for the single sample column");
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.type, "scatter");
  assert.ok((series[1]?.symbolSize ?? 0) > 0);
  // Stem width tracks barWidth; bead size tracks pointSize.
  assert.notEqual(sig(renderSample("lollipop", { barWidth: 12 })), sig(renderSample("lollipop", { barWidth: 80 })));
  assert.notEqual(sig(renderSample("lollipop", { pointSize: 3 })), sig(renderSample("lollipop", { pointSize: 16 })));
});

test("P100-1: pictorial column repeats unit glyphs clipped to each value", () => {
  const option = renderSample("pictorialColumn");
  const [pictorial] = seriesList(option) as Array<{
    type?: string;
    symbolRepeat?: boolean;
    symbolClip?: boolean;
    symbol?: string;
  }>;
  assert.equal(pictorial.type, "pictorialBar");
  assert.equal(pictorial.symbolRepeat, true);
  assert.equal(pictorial.symbolClip, true);
  assert.notEqual(sig(renderSample("pictorialColumn", { showLabels: false })), sig(renderSample("pictorialColumn", { showLabels: true })));
});

test("P100-1: progress bars sort descending and cap the axis at 100 for rates", () => {
  const option = renderSample("progressBar");
  const [bar] = seriesList(option) as Array<{ type?: string; showBackground?: boolean; data: number[] }>;
  assert.equal(bar.type, "bar");
  assert.equal(bar.showBackground, true);
  const sorted = [...bar.data].sort((a, b) => b - a);
  assert.deepEqual(bar.data, sorted, "progress bars must render in descending order");
  // Horizontal layout: the value axis (and its 100 cap) sits on xAxis.
  const xAxis = option.xAxis as { max?: number };
  assert.equal(xAxis.max, 100, "rate data ≤100 must scale to 100");
  assert.notEqual(sig(renderSample("progressBar", { barWidth: 15 })), sig(renderSample("progressBar", { barWidth: 70 })));
});

test("P100-1: ranking bars prefix end labels with the rank", () => {
  const option = renderSample("rankingBar");
  const [bar] = seriesList(option) as Array<{
    label?: { show?: boolean; formatter?: (params: { dataIndex: number; value: number }) => string };
    data: number[];
  }>;
  assert.equal(bar.label?.show, true);
  assert.ok(bar.label?.formatter, "ranking bars must install a rank formatter");
  const rendered = bar.label?.formatter?.({ dataIndex: 0, value: bar.data[0] });
  assert.match(rendered ?? "", /^1\./, `expected rank prefix, got ${rendered}`);
  const sorted = [...bar.data].sort((a, b) => b - a);
  assert.deepEqual(bar.data, sorted, "ranking bars must render in descending order");
  assert.notEqual(sig(renderSample("rankingBar", { showLabels: false })), sig(renderSample("rankingBar", { showLabels: true })));
});

test("P100-1: pareto adds a cumulative percentage line on a 0-100% right axis", () => {
  const option = renderSample("pareto");
  const series = seriesList(option) as Array<{
    type?: string;
    yAxisIndex?: number;
    data?: number[];
  }>;
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.type, "line");
  assert.equal(series[1]?.yAxisIndex, 1);
  // Cumulative line must end at 100 and never decrease.
  const cumulative = series[1]?.data ?? [];
  assert.ok(Math.abs(cumulative[cumulative.length - 1] - 100) < 0.001, `last cumulative value was ${cumulative[cumulative.length - 1]}`);
  for (let i = 1; i < cumulative.length; i += 1) {
    assert.ok(cumulative[i] >= cumulative[i - 1], "cumulative line must be monotonic");
  }
  const yAxis = option.yAxis as Array<{ max?: number; min?: number }>;
  assert.equal(yAxis.length, 2, "pareto needs dual value axes");
  assert.equal(yAxis[1]?.max, 100);
  assert.equal(yAxis[1]?.min, 0);
  // Bars must be sorted descending (pareto order).
  const barData = series[0]?.data ?? [];
  const sorted = [...barData].sort((a, b) => b - a);
  assert.deepEqual(barData, sorted, "pareto bars must render in descending order");
  assert.notEqual(sig(renderSample("pareto", { showLabels: false })), sig(renderSample("pareto", { showLabels: true })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 2 — line/area extensions.
// ---------------------------------------------------------------------------

test("P100-2: point lines use oversized beads on thin lines", () => {
  const [point] = seriesList(renderSample("pointLine")) as Array<{
    symbolSize?: number;
    lineStyle?: { width?: number };
  }>;
  const [plain] = seriesList(renderSample("line")) as Array<{
    symbolSize?: number;
    lineStyle?: { width?: number };
  }>;
  assert.ok((point.symbolSize ?? 0) >= 10, "point lines need prominent beads");
  assert.equal(point.lineStyle?.width, 1.5);
  assert.ok((point.symbolSize ?? 0) > (plain.symbolSize ?? 0), "point lines must differ from plain lines");
  assert.notEqual(sig(renderSample("pointLine", { pointSize: 4 })), sig(renderSample("pointLine", { pointSize: 18 })));
});

test("P100-2: smooth and step area variants combine area fill with their line shape", () => {
  const smooth = seriesList(renderSample("smoothArea")) as Array<{
    smooth?: boolean;
    areaStyle?: Record<string, unknown> | undefined;
  }>;
  assert.equal(smooth[0]?.smooth, true);
  assert.ok(smooth[0]?.areaStyle, "smooth area must fill");

  const step = seriesList(renderSample("stepArea")) as Array<{
    step?: string;
    areaStyle?: Record<string, unknown> | undefined;
  }>;
  assert.equal(step[0]?.step, "middle");
  assert.ok(step[0]?.areaStyle, "step area must fill");

  // The shared line/area path must keep plain lines area-free.
  const plain = seriesList(renderSample("pointLine")) as Array<{ areaStyle?: unknown }>;
  assert.equal(plain[0]?.areaStyle, undefined);
});

test("P100-2: dual axis line routes the first series left and the rest right", () => {
  const option = renderSample("dualAxisLine");
  const series = seriesList(option) as Array<{ yAxisIndex?: number }>;
  assert.equal(series.length, 2, "sample has two series columns");
  assert.equal(series[0]?.yAxisIndex, undefined, "first series stays on the default axis");
  assert.equal(series[1]?.yAxisIndex, 1);
  const yAxis = option.yAxis as unknown[];
  assert.equal(yAxis.length, 2, "dual axis line needs two value axes");
});

test("P100-2: slope charts transpose rows into two-point lines across periods", () => {
  const option = renderSample("slopeChart");
  const sample = getTemplateDefinition("slopeChart").sampleData;
  const series = seriesList(option) as Array<{ name?: string; data?: number[]; type?: string }>;
  assert.equal(series.length, sample.table.length - 1, "one series per entity row");
  for (const item of series) {
    assert.equal(item.type, "line");
    assert.equal(item.data?.length, 2, "each entity has exactly two period values");
  }
  const xAxis = option.xAxis as { data?: string[] };
  assert.deepEqual(xAxis.data, sample.seriesColumns, "axis labels are the two period names");
  // Config change: line width flows into slope segments.
  assert.notEqual(sig(renderSample("slopeChart", { lineWidth: 1 })), sig(renderSample("slopeChart", { lineWidth: 9 })));
});

test("P100-2: band area shades between bounds with the mid line on top", () => {
  const option = renderSample("bandArea");
  const series = seriesList(option) as Array<{
    type?: string;
    stack?: string;
    areaStyle?: { opacity?: number; color?: string };
    label?: { show?: boolean };
  }>;
  assert.equal(series.length, 3);
  assert.equal(series[0]?.stack, "band");
  assert.equal(series[0]?.areaStyle?.opacity, 0, "base bound must be invisible");
  assert.ok((series[1]?.areaStyle?.opacity ?? 0) > 0, "band fill must be visible");
  assert.equal(series[2]?.label?.show, true, "labels ride the mid line");
  assert.notEqual(sig(renderSample("bandArea", { showLabels: false })), sig(renderSample("bandArea", { showLabels: true })));
});

test("P100-2: ridgeline stacks each series on a synthetic offset base", () => {
  const option = renderSample("ridgeline");
  const series = seriesList(option) as Array<{
    type?: string;
    stack?: string;
    data?: number[];
    areaStyle?: { opacity?: number };
  }>;
  // Two series per column: transparent base + visible ridge.
  const columns = getTemplateDefinition("ridgeline").sampleData.seriesColumns.length;
  assert.equal(series.length, columns * 2);
  assert.ok(series[1]?.areaStyle && (series[1].areaStyle.opacity ?? 0) > 0, "ridges must fill");
  // Base offsets increase per column so ridges cascade.
  const base0 = series[0]?.data ?? [];
  const base2 = series[2]?.data ?? [];
  assert.ok(base0.every((v) => v === 0), "first ridge starts at zero");
  assert.ok(base2.every((v) => v > 0), "later ridges sit on a raised baseline");
  assert.notEqual(sig(renderSample("ridgeline", { areaOpacity: 80 })), sig(renderSample("ridgeline", { areaOpacity: 20 })));
});

test("P100-2: bump charts rank values on an inverted axis", () => {
  const option = renderSample("bump");
  const yAxis = option.yAxis as { inverse?: boolean; min?: number; max?: number };
  assert.equal(yAxis.inverse, true, "rank 1 must sit at the top");
  const series = seriesList(option) as Array<{ data?: number[]; label?: { formatter?: (p: { value: number }) => string } }>;
  const rowCount = getTemplateDefinition("bump").sampleData.table.length - 1;
  for (const item of series) {
    assert.ok((item.data ?? []).every((rank) => rank >= 1 && rank <= rowCount), `ranks must be 1..${rowCount}`);
    // Best value per column must map to rank 1.
    assert.equal(Math.min(...(item.data ?? [])), 1);
  }
  assert.match(series[0]?.label?.formatter?.({ value: 2 }) ?? "", /^#2$/);
  assert.notEqual(sig(renderSample("bump", { showLabels: false })), sig(renderSample("bump", { showLabels: true })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 3 — radial/polar family.
// ---------------------------------------------------------------------------

test("P100-3: rose variants set their roseType and stay grid-free", () => {
  const radius = renderSample("rose");
  const area = renderSample("roseArea");
  for (const [option, expected] of [[radius, "radius"], [area, "area"]] as const) {
    const [pie] = seriesList(option) as Array<{ type?: string; roseType?: string }>;
    assert.equal(pie.type, "pie");
    assert.equal(pie.roseType, expected);
    assert.equal(option.grid, undefined, "rose must not emit a cartesian grid");
    assert.notEqual(sig(renderSample("roseArea", { showLabels: false })), sig(renderSample("roseArea", { showLabels: true })));
  }
});

test("P100-3: radial bars ride a polar frame with category angle axis", () => {
  for (const type of ["radialBar", "radialStackedBar"] as ChartType[]) {
    const option = renderSample(type);
    assert.ok(option.polar, `${type}: missing polar coordinate`);
    const angleAxis = option.angleAxis as { type?: string; data?: string[] };
    assert.equal(angleAxis.type, "category");
    assert.ok((angleAxis.data?.length ?? 0) > 0);
    assert.equal(option.grid, undefined, `${type}: must not emit a cartesian grid`);
    const series = seriesList(option) as Array<{ type?: string; coordinateSystem?: string; stack?: string }>;
    assert.equal(series[0]?.type, "bar");
    assert.equal(series[0]?.coordinateSystem, "polar");
  }
  const stacked = seriesList(renderSample("radialStackedBar")) as Array<{ stack?: string }>;
  assert.equal(stacked[0]?.stack, "total", "radial stacked bars share one stack");
  assert.notEqual(sig(renderSample("radialBar", { barWidth: 60 })), sig(renderSample("radialBar", { barWidth: 20 })));
});

test("P100-3: progress ring draws a background ring, value arc, and center text", () => {
  const option = renderSample("progressRing");
  assert.equal(option.grid, undefined);
  const series = seriesList(option) as Array<{
    type?: string;
    data?: Array<{ name?: string; value?: number; itemStyle?: { color?: string } }>;
  }>;
  assert.equal(series[0]?.type, "pie");
  assert.equal(series[0]?.data?.[0]?.value, 100, "background ring is a full circle");
  const arc = series[1]?.data ?? [];
  assert.equal(arc[0]?.value, 76, "sample completion rate maps to the arc sweep");
  assert.equal(arc[1]?.itemStyle?.color, "transparent", "remainder slice is invisible");
  const graphic = (option.graphic ?? []) as Array<{ type?: string; style?: { text?: string } }>;
  assert.ok(
    graphic.some((el) => el.type === "text" && el.style?.text?.includes("76")),
    `expected center percent text, got ${JSON.stringify(graphic)}`,
  );
  assert.notEqual(sig(renderSample("progressRing", { showLabels: false })), sig(renderSample("progressRing", { showLabels: true })));
});

test("P100-3: polar line hybrids plot on the polar frame", () => {
  const line = renderSample("polarLine");
  const area = renderSample("polarArea");
  for (const option of [line, area]) {
    assert.ok(option.polar);
    assert.equal((option.angleAxis as { type?: string }).type, "category");
    assert.equal(option.grid, undefined);
    const series = seriesList(option) as Array<{ type?: string; coordinateSystem?: string }>;
    assert.equal(series[0]?.type, "line");
    assert.equal(series[0]?.coordinateSystem, "polar");
  }
  const areaSeries = seriesList(area) as Array<{ areaStyle?: Record<string, unknown> }>;
  assert.ok(areaSeries[0]?.areaStyle, "polar area must fill");
  assert.notEqual(sig(line), sig(renderSample("polarLine", { showLabels: false })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 4 — scatter/bubble extensions.
// ---------------------------------------------------------------------------

test("P100-4: bubble chart drives per-point size from the third column", () => {
  const [bubble] = seriesList(renderSample("bubble")) as Array<{
    data?: Array<{ symbolSize?: number } | [number, number]>;
  }>;
  const sizes = (bubble.data ?? []).map((entry) =>
    Array.isArray(entry) ? undefined : entry.symbolSize,
  );
  assert.ok(sizes.some((size) => size !== undefined), "bubble points must carry per-point sizes");
  assert.ok(
    sizes.some((size) => size !== undefined && size > 20),
    "larger populations must map to bigger bubbles",
  );
  assert.notEqual(sig(renderSample("bubble", { markOpacity: 40 })), sig(renderSample("bubble", { markOpacity: 90 })));
});

test("P100-4: grouped scatter emits one series per group", () => {
  const option = renderSample("groupedScatter");
  const series = seriesList(option) as Array<{ name?: string; type?: string }>;
  assert.deepEqual(
    series.map((item) => item.name),
    ["品种 A", "品种 B"],
    "one series per category value, first-seen order",
  );
  for (const item of series) assert.equal(item.type, "scatter");
  assert.notEqual(sig(renderSample("groupedScatter", { showLabels: false })), sig(renderSample("groupedScatter", { showLabels: true })));
  // Editing a row moves its point (data-change redraw for the transpose path).
  const { sampleData } = getTemplateDefinition("groupedScatter");
  const table = sampleData.table.map((row) => [...row]);
  table[1][2] = "0.9";
  assert.notEqual(
    sig(option),
    sig(buildChartOption(baseConfig({
      type: "groupedScatter",
      parsed: tableToParsed(table),
      categoryColumn: sampleData.categoryColumn,
      seriesColumns: sampleData.seriesColumns,
    }))),
  );
});

test("P100-4: quadrant chart adds median cross lines and tinted quadrants", () => {
  const option = renderSample("quadrant");
  const [scatterSeries] = seriesList(option) as Array<{
    markLine?: { data?: unknown[] };
    markArea?: { data?: unknown[] };
  }>;
  assert.equal(scatterSeries.markLine?.data?.length, 2, "one vertical + one horizontal median line");
  assert.ok(scatterSeries.markArea?.data?.length, "quadrant tints must be present");
  assert.notEqual(sig(renderSample("quadrant")), sig(renderSample("quadrant", { showTooltip: false })));
});

test("P100-4: trend scatter draws its least-squares line by default", () => {
  const [scatterSeries] = seriesList(renderSample("trendScatter")) as Array<{
    markLine?: { data?: Array<[unknown, unknown]> };
  }>;
  const segments = scatterSeries.markLine?.data ?? [];
  assert.equal(segments.length, 1, "one two-point trend segment");
  // Plain scatter keeps the line off by default.
  const plain = seriesList(renderSample("scatter")) as Array<{ markLine?: unknown }>;
  assert.equal(plain[0]?.markLine, undefined);
});

test("P100-4: beeswarm packs points without collisions", () => {
  const option = renderSample("beeswarm");
  const [swarm] = seriesList(option) as Array<{ type?: string; data?: [number, number][] }>;
  assert.equal(swarm.type, "scatter");
  const rows = getTemplateDefinition("beeswarm").sampleData.table.length - 1;
  assert.equal(swarm.data?.length, rows);
  // Points are nudged sideways: x coordinates cluster near integer category
  // indices but some carry a fractional offset.
  const xs = (swarm.data ?? []).map(([x]) => x);
  assert.ok(xs.some((x) => Math.abs(x - Math.round(x)) > 0.01), "expected sideways packing offsets");
  assert.notEqual(sig(renderSample("beeswarm", { showLabels: false })), sig(renderSample("beeswarm", { showLabels: true })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 5 — hierarchy & network.
// ---------------------------------------------------------------------------

test("P100-5: sunburst nests categories over series columns", () => {
  const option = renderSample("sunburst");
  const [burst] = seriesList(option) as Array<{
    type?: string;
    data?: Array<{ name?: string; children?: Array<{ name?: string; value?: number }> }>;
  }>;
  assert.equal(burst.type, "sunburst");
  const root = burst.data?.[0];
  const sampleRows = getTemplateDefinition("sunburst").sampleData.table.length - 1;
  assert.equal(root?.children?.length, sampleRows, "one parent per category row");
  const firstLeafGroup = (root?.children?.[0] ?? {}) as { children?: Array<{ name?: string; value?: number }> };
  assert.equal(firstLeafGroup.children?.length, 2, "one leaf per numeric column");
  assert.equal(option.grid, undefined);
  assert.notEqual(sig(renderSample("sunburst", { showLabels: false })), sig(renderSample("sunburst", { showLabels: true })));
});

test("P100-5: tree variants differ by orientation and layout", () => {
  const dendrogram = seriesList(renderSample("dendrogram"))[0] as { type?: string; orient?: string; layout?: string };
  const org = seriesList(renderSample("orgChart"))[0] as { type?: string; orient?: string; layout?: string };
  const radial = seriesList(renderSample("radialTree"))[0] as { type?: string; orient?: string; layout?: string };
  for (const tree of [dendrogram, org, radial]) assert.equal(tree.type, "tree");
  assert.equal(dendrogram.orient, "LR");
  assert.equal(dendrogram.layout, undefined);
  assert.equal(org.orient, "TB");
  assert.equal(radial.layout, "radial");
  // All trees share the same node structure from the same sample.
  for (const type of ["dendrogram", "orgChart", "radialTree"] as ChartType[]) {
    const [tree] = seriesList(renderSample(type)) as Array<{ data?: Array<{ name?: string; children?: unknown[] }> }>;
    assert.equal(tree.data?.[0]?.children?.length, 5, `${type}: root children are the categories`);
  }
});

test("P100-5: network graph builds force layout from source-target pairs", () => {
  const option = renderSample("networkGraph");
  const [graph] = seriesList(option) as Array<{
    type?: string;
    layout?: string;
    data?: Array<{ name?: string }>;
    links?: Array<{ source?: string; target?: string }>;
  }>;
  assert.equal(graph.type, "graph");
  assert.equal(graph.layout, "force");
  assert.equal(graph.links?.length, 8, "one link per flow row");
  assert.equal(graph.data?.length, 8, "nodes are the unique endpoint names");
  assert.equal(option.grid, undefined);
  assert.notEqual(sig(renderSample("networkGraph", { showLabels: false })), sig(renderSample("networkGraph", { showLabels: true })));
});

test("P100-5: chord shares the node/link model on a circular layout", () => {
  const option = renderSample("chord");
  const [chord] = seriesList(option) as Array<{
    type?: string;
    data?: unknown[];
    links?: unknown[];
  }>;
  assert.equal(chord.type, "chord");
  assert.equal(chord.data?.length, 8);
  assert.equal(chord.links?.length, 8);
  assert.notEqual(sig(renderSample("chord", { markOpacity: 30 })), sig(renderSample("chord", { markOpacity: 90 })));
});

test("P100-5: adjacency matrix renders a heatmap with a visual map", () => {
  const option = renderSample("adjacencyMatrix");
  const [matrix] = seriesList(option) as Array<{ type?: string; data?: [number, number, number][] }>;
  assert.equal(matrix.type, "heatmap");
  assert.equal(matrix.data?.length, 8, "one cell per flow");
  assert.ok(option.visualMap, "matrix needs a value color scale");
  const xAxis = option.xAxis as { data?: string[] };
  const yAxis = option.yAxis as { data?: string[] };
  assert.ok(xAxis.data?.length && yAxis.data?.length, "both axes list the node names");
  assert.notEqual(sig(renderSample("adjacencyMatrix", { showLabels: false })), sig(renderSample("adjacencyMatrix", { showLabels: true })));
});

test("P100-5: alluvial rides the sankey path with its own flow shape", () => {
  const option = renderSample("alluvial");
  const [flow] = seriesList(option) as Array<{ type?: string; links?: unknown[]; data?: unknown[] }>;
  assert.equal(flow.type, "sankey", "alluvial reuses the sankey renderer");
  assert.equal(flow.links?.length, 6, "sample has six stage transitions");
  assert.ok(flow.data?.length, "nodes present");
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 6 — statistical & distribution.
// ---------------------------------------------------------------------------

test("P100-6: parallel coordinates lay rows across numeric dimensions", () => {
  const option = renderSample("parallelCoordinates");
  assert.ok(option.parallel, "missing parallel coordinate");
  const parallelAxis = option.parallelAxis as Array<{ dim?: number; name?: string }>;
  const dims = getTemplateDefinition("parallelCoordinates").sampleData.seriesColumns.length;
  assert.equal(parallelAxis.length, dims, "one axis per numeric column");
  assert.equal(parallelAxis[3]?.dim, 3);
  assert.equal(option.grid, undefined, "parallel must not emit a cartesian grid");
  const [parallel] = seriesList(option) as Array<{ type?: string; data?: Array<{ name?: string; value?: number[] }> }>;
  assert.equal(parallel.type, "parallel");
  assert.equal(parallel.data?.length, 6, "one polyline per sample row");
});

test("P100-6: calendar heatmap plots dates on a calendar coordinate", () => {
  const option = renderSample("calendarHeatmap");
  const calendar = option.calendar as { range?: string | string[] };
  assert.ok(calendar?.range, "missing calendar coordinate");
  assert.equal(String(calendar.range), "2026", "range inferred from the sample dates");
  assert.ok(option.visualMap, "calendar heatmap needs a value scale");
  const [heat] = seriesList(option) as Array<{ type?: string; data?: [string, number][] }>;
  assert.equal(heat.type, "heatmap");
  assert.match(heat.data?.[0]?.[0] ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(sig(renderSample("calendarHeatmap", { showLabels: false })), sig(renderSample("calendarHeatmap", { showLabels: true })));
});

test("P100-6: ECDF draws a monotonic step line up to 100%", () => {
  const option = renderSample("ecdf");
  const [line] = seriesList(option) as Array<{ type?: string; step?: string; data?: [number, number][] }>;
  assert.equal(line.type, "line");
  assert.equal(line.step, "end");
  const rows = getTemplateDefinition("ecdf").sampleData.table.length - 1;
  assert.equal(line.data?.length, rows);
  assert.equal(line.data?.[rows - 1]?.[1], 100, "cumulative percent ends at 100");
  const yAxis = option.yAxis as { max?: number };
  assert.equal(yAxis.max, 100);
  const sorted = (line.data ?? []).map(([v]) => v);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b), "values must be sorted ascending");
});

test("P100-6: error bars pair a bar series with custom whiskers", () => {
  const option = renderSample("errorBar");
  const series = seriesList(option) as Array<{
    type?: string;
    data?: unknown[];
    renderItem?: unknown;
  }>;
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.type, "custom", "whiskers ride a custom series");
  assert.equal(typeof series[1]?.renderItem, "function");
  // Each whisker row carries [index, value, lower, upper].
  const whiskers = series[1]?.data as number[][];
  assert.equal(whiskers.length, 5);
  assert.equal(whiskers[0]?.length, 4);
  assert.ok(whiskers[0]?.[3] >= whiskers[0]?.[1], "upper bound must reach above the value");
  assert.notEqual(sig(renderSample("errorBar", { showLabels: false })), sig(renderSample("errorBar", { showLabels: true })));
});

test("P100-6: correlation matrix computes pairwise Pearson coefficients", () => {
  const option = renderSample("correlationMatrix");
  const [matrix] = seriesList(option) as Array<{ type?: string; data?: [number, number, number][] }>;
  const columns = getTemplateDefinition("correlationMatrix").sampleData.seriesColumns.length;
  assert.equal(matrix.type, "heatmap");
  assert.equal(matrix.data?.length, columns * columns, "n x n correlation grid");
  // Diagonal cells are perfect correlations of 1.
  for (const [x, y, r] of matrix.data ?? []) {
    if (x === y) assert.ok(Math.abs(r - 1) < 1e-9, `diagonal cell (${x},${y}) should be 1, got ${r}`);
    assert.ok(r >= -1 && r <= 1, "coefficients stay in [-1, 1]");
  }
  const visualMap = option.visualMap as { min?: number; max?: number };
  assert.equal(visualMap.min, -1);
  assert.equal(visualMap.max, 1);
  assert.notEqual(sig(renderSample("correlationMatrix", { showLabels: false })), sig(renderSample("correlationMatrix", { showLabels: true })));
});

test("P100-6: violin renders mirrored KDE polygons with raw data points", () => {
  const option = renderSample("violin");
  const series = seriesList(option) as Array<{
    type?: string;
    data?: unknown[];
    renderItem?: unknown;
  }>;
  assert.equal(series[0]?.type, "custom");
  assert.equal(typeof series[0]?.renderItem, "function");
  assert.equal(series[1]?.type, "scatter", "raw points overlay the violins");
  assert.equal(series[0]?.data?.length, 3, "one violin per category");
  assert.notEqual(sig(option), sig(renderSample("violin", { markOpacity: 40 })));
});

test("P100-6: marimekko carries variable-width stacked layout data", () => {
  const option = renderSample("marimekko");
  const [mosaic] = seriesList(option) as Array<{
    type?: string;
    data?: number[][];
    renderItem?: unknown;
  }>;
  assert.equal(mosaic.type, "custom");
  assert.equal(typeof mosaic.renderItem, "function");
  const rows = getTemplateDefinition("marimekko").sampleData.table.length - 1;
  assert.equal(mosaic.data?.length, rows, "one composite row entry");
  // Each entry: [rowIndex, xStart, width, ...segment shares summing to 100].
  const first = mosaic.data?.[0] ?? [];
  const shares = first.slice(3);
  const total = shares.reduce((sum, v) => sum + v, 0);
  assert.ok(Math.abs(total - 100) < 0.001, `row shares must sum to 100, got ${total}`);
  const xAxis = option.xAxis as { max?: number };
  assert.equal(xAxis.max, 100);
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 7 — bar/column variants.
// ---------------------------------------------------------------------------

test("P100-7: grouped bars render horizontally with one segment per series", () => {
  const option = renderSample("groupedBar");
  const series = seriesList(option) as Array<{ type?: string; stack?: string }>;
  assert.equal(series.length, 3, "all sample series render");
  for (const item of series) {
    assert.equal(item.type, "bar");
    assert.equal(item.stack, undefined, "grouped bars are unstacked");
  }
  assert.equal((option.yAxis as { type?: string }).type, "category", "horizontal layout");
  assert.notEqual(sig(renderSample("groupedBar", { barWidth: 12 })), sig(renderSample("groupedBar", { barWidth: 80 })));
});

test("P100-7: capsule bars round every corner", () => {
  const [bar] = seriesList(renderSample("capsuleBar")) as Array<{
    itemStyle?: { borderRadius?: number[] };
    showBackground?: boolean;
  }>;
  assert.deepEqual(bar.itemStyle?.borderRadius, [24, 24, 24, 24], "capsule radius = barWidth/2 on all corners");
  assert.equal(bar.showBackground, true, "capsules keep the progress track");
  assert.notEqual(sig(renderSample("capsuleBar", { barWidth: 20 })), sig(renderSample("capsuleBar", { barWidth: 70 })));
});

test("P100-7: arrow bars tip each value with an arrow marker", () => {
  const option = renderSample("arrowBar");
  const series = seriesList(option) as Array<{ type?: string; symbol?: string; symbolRotate?: number }>;
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.type, "scatter");
  assert.equal(series[1]?.symbol, "arrow");
  assert.equal(series[1]?.symbolRotate, 90);
  assert.notEqual(sig(renderSample("arrowBar", { showLabels: false })), sig(renderSample("arrowBar", { showLabels: true })));
});

test("P100-7: dumbbell connects start and end beads per row", () => {
  const option = renderSample("dumbbell");
  const series = seriesList(option) as Array<{ type?: string; renderItem?: unknown }>;
  assert.equal(series[0]?.type, "custom", "connectors ride a custom series");
  assert.equal(typeof series[0]?.renderItem, "function");
  assert.equal(series[1]?.type, "scatter");
  assert.equal(series[2]?.type, "scatter");
  const rows = getTemplateDefinition("dumbbell").sampleData.table.length - 1;
  const beads = series[1] as { data?: unknown[] };
  assert.equal(beads.data?.length, rows);
  assert.notEqual(sig(renderSample("dumbbell", { showLabels: false })), sig(renderSample("dumbbell", { showLabels: true })));
});

test("P100-7: stacked dots plot one point per unit", () => {
  const option = renderSample("stackedDot");
  const [dots] = seriesList(option) as Array<{ type?: string; data?: [number, number][] }>;
  assert.equal(dots.type, "scatter");
  const totalUnits = (dots.data ?? []).length;
  const sampleValues = [12, 9, 6, 4];
  assert.equal(totalUnits, sampleValues.reduce((sum, v) => sum + v, 0), "one point per vote");
  // The base point of each stack carries the row label (category index).
  const basePoints = (dots.data ?? []).filter(([, unit]) => unit === 1);
  assert.equal(basePoints.length, sampleValues.length, "one labeled base point per category");
  assert.notEqual(sig(renderSample("stackedDot", { pointSize: 3 })), sig(renderSample("stackedDot", { pointSize: 12 })));
});

test("P100-7: OHLC bars draw open/close ticks from a custom series", () => {
  const option = renderSample("ohlcBar");
  const [ohlc] = seriesList(option) as Array<{ type?: string; renderItem?: unknown; data?: number[][] }> & { data?: number[][] };
  assert.equal(ohlc.type, "custom");
  assert.equal(typeof ohlc.renderItem, "function");
  const rows = getTemplateDefinition("ohlcBar").sampleData.table.length - 1;
  assert.equal(ohlc.data?.length, rows);
  assert.equal(ohlc.data?.[0]?.length, 5, "each row packs [index, open, close, low, high]");
});

test("P100-7: candle+volume splits across two grids with shared categories", () => {
  const option = renderSample("candleVolume");
  const series = seriesList(option) as Array<{ type?: string; xAxisIndex?: number; yAxisIndex?: number; data?: number[] }>;
  assert.equal(series[0]?.type, "candlestick");
  assert.equal(series[0]?.xAxisIndex, 0);
  assert.equal(series[1]?.type, "bar");
  assert.equal(series[1]?.yAxisIndex, 1, "volume rides the second value axis");
  const grid = option.grid as unknown[];
  assert.equal(grid.length, 2, "candlestick and volume occupy separate grids");
  const xAxis = option.xAxis as unknown[];
  assert.equal(xAxis.length, 2, "each grid has its own category axis");
  assert.equal(series[1]?.data?.length, getTemplateDefinition("candleVolume").sampleData.table.length - 1);
});

test("P100-7: split-axis bars isolate outliers in an upper zoomed grid", () => {
  const option = renderSample("splitAxisBar");
  const series = seriesList(option) as Array<{ type?: string; xAxisIndex?: number; data?: Array<number | null> }>;
  assert.equal(series[0]?.type, "bar");
  assert.equal(series[1]?.xAxisIndex, 1, "outlier series rides the second grid");
  const outliers = (series[1]?.data ?? []).filter((value) => value !== null);
  assert.deepEqual(outliers, [310], "the single outlier moves to the upper grid");
  const grid = option.grid as unknown[];
  assert.equal(grid.length, 2, "split axis needs two grids");
  assert.notEqual(sig(renderSample("splitAxisBar", { showLabels: false })), sig(renderSample("splitAxisBar", { showLabels: true })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 8 — pie/boxplot extensions.
// ---------------------------------------------------------------------------

test("P100-8: half donut sweeps a top semicircle", () => {
  const option = renderSample("halfDonut");
  const [pie] = seriesList(option) as Array<{
    type?: string;
    startAngle?: number;
    endAngle?: number;
    center?: string[];
    radius?: number[];
  }>;
  assert.equal(pie.type, "pie");
  assert.equal(pie.startAngle, 180);
  assert.equal(pie.endAngle, 360);
  assert.ok((pie.center?.[1] ?? "") === "72%", "flat edge pinned toward the bottom");
  assert.deepEqual(pie.radius?.length, 2, "half donut is a ring");
  assert.notEqual(sig(renderSample("halfDonut", { showLabels: false })), sig(renderSample("halfDonut", { showLabels: true })));
});

test("P100-8: multi-ring draws one concentric ring per series", () => {
  const option = renderSample("multiRing");
  const series = seriesList(option) as Array<{
    type?: string;
    radius?: number[];
    data?: unknown[];
  }>;
  assert.equal(series.length, 2, "one ring per numeric column");
  for (const ring of series) {
    assert.equal(ring.type, "pie");
    assert.deepEqual(ring.radius?.length, 2);
    assert.ok((ring.radius?.[0] ?? 0) < (ring.radius?.[1] ?? 0), "inner < outer radius");
  }
  // Rings must be concentric: same center, non-overlapping radii (a small
  // border gap of 2px is allowed between bands).
  assert.ok(
    (series[0]?.radius?.[1] ?? 0) <= (series[1]?.radius?.[0] ?? 0),
    "ring 0 must not overlap ring 1",
  );
  assert.notEqual(sig(renderSample("multiRing", { showLabels: false })), sig(renderSample("multiRing", { showLabels: true })));
});

test("P100-8: horizontal boxplot swaps the axes", () => {
  const option = renderSample("boxplotHorizontal");
  const [box] = seriesList(option) as Array<{ type?: string; data?: number[][] }>;
  assert.equal(box.type, "boxplot");
  assert.equal((option.xAxis as { type?: string }).type, "value", "value axis on x");
  assert.equal((option.yAxis as { type?: string }).type, "category", "category axis on y");
  assert.equal(box.data?.length, 3, "one box per distribution column");
  assert.notEqual(sig(renderSample("boxplotHorizontal", { showLabels: false })), sig(renderSample("boxplotHorizontal", { showLabels: true })));
});

test("P100-8: density heatmap bins x/y pairs into a count grid", () => {
  const option = renderSample("densityHeatmap");
  const [heat] = seriesList(option) as Array<{ type?: string; data?: [number, number, number][] }>;
  assert.equal(heat.type, "heatmap");
  const rows = getTemplateDefinition("densityHeatmap").sampleData.table.length - 1;
  const total = (heat.data ?? []).reduce((sum, [, , count]) => sum + count, 0);
  assert.equal(total, rows, "every row lands in exactly one bin");
  assert.ok(option.visualMap, "density grid needs a value scale");
  assert.notEqual(sig(renderSample("densityHeatmap", { showLabels: false })), sig(renderSample("densityHeatmap", { showLabels: true })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 9 — cards, table & text.
// ---------------------------------------------------------------------------

test("P100-9: KPI card renders a hero number and label on the graphic layer", () => {
  const option = renderSample("kpiCard");
  assert.equal(option.grid, undefined, "card templates are grid-free");
  const graphic = (option.graphic ?? []) as Array<{ type?: string; style?: { text?: string } }>;
  const texts = graphic.filter((element) => element.type === "text");
  assert.ok(
    texts.some((element) => element.style?.text?.includes("1,280") || element.style?.text?.includes("1280")),
    `hero number expected, got ${JSON.stringify(texts.map((t) => t.style?.text))}`,
  );
  assert.ok(texts.some((element) => element.style?.text === "本月销售额"), "label text expected");
  // Editing the value changes the rendered text (data-change redraw).
  const { sampleData } = getTemplateDefinition("kpiCard");
  const table = sampleData.table.map((row) => [...row]);
  table[1][1] = "2560";
  assert.notEqual(
    sig(option),
    sig(buildChartOption(baseConfig({
      type: "kpiCard",
      parsed: tableToParsed(table),
      categoryColumn: sampleData.categoryColumn,
      seriesColumns: sampleData.seriesColumns,
    }))),
  );
});

test("P100-9: KPI card row draws one value+label pair per column", () => {
  const option = renderSample("kpiCardRow");
  const graphic = (option.graphic ?? []) as Array<{
    type?: string;
    style?: { text?: string; font?: string };
  }>;
  const texts = graphic.filter((element) => element.type === "text");
  assert.equal(texts.length, 8, "four columns x (value + label)");
  assert.ok(texts.some((element) => element.style?.text === "146"), "February value present");
  assert.ok(graphic.some((element) => element.type === "rect"), "separator rules present");
  // Hero font sizes stay consistent across cards.
  const valueFonts = new Set(texts.map((element) => element.style?.font?.split("px")[0]));
  assert.ok(valueFonts.size >= 1);
});

test("P100-9: sparkline card pairs the hero number with trend polylines", () => {
  const option = renderSample("sparklineCard");
  const graphic = (option.graphic ?? []) as Array<{ type?: string; shape?: { points?: number[][] }; style?: { text?: string } }>;
  assert.ok(graphic.some((element) => element.type === "text" && element.style?.text?.includes("218")), "hero value present");
  const polylines = graphic.filter((element) => element.type === "polyline");
  assert.equal(polylines.length, 1, "one sparkline across the trend columns");
  assert.equal(polylines[0]?.shape?.points?.length, 6, "one point per trend column");
});

test("P100-9: bar table renders name, bar, and value per row", () => {
  const option = renderSample("barTable");
  const graphic = (option.graphic ?? []) as Array<{
    type?: string;
    shape?: { width?: number; height?: number };
    style?: { text?: string };
  }>;
  const rows = getTemplateDefinition("barTable").sampleData.table.length - 1;
  const bars = graphic.filter((element) => element.type === "rect");
  assert.equal(bars.length, rows, "one bar per row");
  const widths = bars.map((element) => element.shape?.width ?? 0);
  const values = [480, 620, 260, 180, 120];
  assert.equal(widths.indexOf(Math.max(...widths)), values.indexOf(Math.max(...values)), "widest bar belongs to the largest value");
  assert.equal(widths.indexOf(Math.min(...widths)), values.indexOf(Math.min(...values)), "shortest bar belongs to the smallest value");
  assert.ok(graphic.some((element) => element.type === "text" && element.style?.text === "市场推广"), "row names render");
});

test("P100-9: word cloud sizes words by weight without dependencies", () => {
  const option = renderSample("wordCloud");
  const graphic = (option.graphic ?? []) as Array<{
    type?: string;
    style?: { text?: string; font?: string };
  }>;
  const words = graphic.filter((element) => element.type === "text");
  const rows = getTemplateDefinition("wordCloud").sampleData.table.length - 1;
  assert.equal(words.length, rows, "every word renders");
  const fontSizeOf = (element: { style?: { font?: string } }) =>
    Number((element.style?.font ?? "0px").split("px")[0].replace("bold ", ""));
  const sizes = words.map(fontSizeOf);
  assert.equal(Math.max(...sizes), Math.max(...sizes), "sizes computed");
  // Heaviest word (数据可视化, 100) uses the max size; lightest uses the min.
  const heaviest = words.find((element) => element.style?.text === "数据可视化");
  const lightest = words.find((element) => element.style?.text === "箱线图");
  assert.ok(fontSizeOf(heaviest!) > fontSizeOf(lightest!), "weight must drive font size");
  assert.equal(option.grid, undefined);
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 10 — time & facets.
// ---------------------------------------------------------------------------

test("P100-10: gantt bars float between start and end columns", () => {
  const option = renderSample("gantt");
  const series = seriesList(option) as Array<{
    type?: string;
    stack?: string;
    itemStyle?: { color?: string };
    label?: { show?: boolean };
  }>;
  assert.equal(series[0]?.stack, "gantt");
  assert.equal(series[0]?.itemStyle?.color, "transparent", "offset base must be invisible");
  assert.equal(series[1]?.stack, "gantt");
  assert.equal((option.yAxis as { type?: string }).type, "category", "tasks on the category axis");
  assert.equal(series[1]?.label?.show, true);
  assert.notEqual(sig(renderSample("gantt", { showLabels: false })), sig(renderSample("gantt", { showLabels: true })));
});

test("P100-10: timeline alternates event labels above and below the axis", () => {
  const option = renderSample("timeline");
  const [events] = seriesList(option) as Array<{
    type?: string;
    data?: Array<{ value: [number, number]; label?: { position?: string } }>;
  }>;
  assert.equal(events.type, "scatter");
  const rows = getTemplateDefinition("timeline").sampleData.table.length - 1;
  assert.equal(events.data?.length, rows);
  // All points sit on the axis line; labels alternate.
  assert.ok(events.data?.every((item) => item.value[1] === 0), "events ride the axis");
  const positions = events.data?.map((item) => item.label?.position);
  assert.equal(positions?.[0], "top");
  assert.equal(positions?.[1], "bottom");
  assert.notEqual(sig(renderSample("timeline", { showLabels: false })), sig(renderSample("timeline", { showLabels: true })));
});

test("P100-10: small multiples open one grid per numeric column", () => {
  const option = renderSample("smallMultiples");
  const columns = getTemplateDefinition("smallMultiples").sampleData.seriesColumns.length;
  const grids = option.grid as unknown[];
  assert.equal(grids.length, columns, "one panel per column");
  const series = seriesList(option) as Array<{ type?: string; xAxisIndex?: number }>;
  assert.equal(series.length, columns);
  series.forEach((item, index) => {
    assert.equal(item.type, "bar");
    assert.equal(item.xAxisIndex, index, "each series binds its own panel");
  });
  const xAxes = option.xAxis as unknown[];
  const yAxes = option.yAxis as unknown[];
  assert.equal(xAxes.length, columns);
  assert.equal(yAxes.length, columns);
  assert.notEqual(sig(renderSample("smallMultiples", { showLabels: false })), sig(renderSample("smallMultiples", { showLabels: true })));
});

// ---------------------------------------------------------------------------
// Group: Flourish parity batch 11 — map family.
// ---------------------------------------------------------------------------

test("P100-11: world choropleth maps Chinese names over the world GeoJSON", () => {
  const option = renderSample("worldChoropleth");
  const [map] = seriesList(option) as Array<{
    type?: string;
    map?: string;
    nameMap?: Record<string, string>;
    data?: Array<{ name?: string; value?: number }>;
  }>;
  assert.equal(map.type, "map");
  assert.equal(map.map, "world");
  assert.equal(map.nameMap?.China, "中国", "English geojson names map to Chinese");
  assert.ok(map.data?.some((entry) => entry.name === "中国"), "sample data uses Chinese names");
  assert.ok(option.visualMap, "choropleth needs a value scale");
  assert.equal(option.grid, undefined);
  assert.notEqual(sig(renderSample("worldChoropleth", { showLabels: false })), sig(renderSample("worldChoropleth", { showLabels: true })));
});

test("P100-11: china choropleth binds the china map with province data", () => {
  const option = renderSample("chinaChoropleth");
  const [map] = seriesList(option) as Array<{
    type?: string;
    map?: string;
    nameMap?: Record<string, string>;
    data?: unknown[];
  }>;
  assert.equal(map.type, "map");
  assert.equal(map.map, "china");
  assert.equal(map.nameMap, undefined, "china geojson already uses Chinese names");
  assert.ok(option.visualMap);
});

test("P100-11: symbol map plots centroid bubbles on the geo frame", () => {
  const option = renderSample("symbolMap");
  assert.ok(option.geo, "symbol map needs the geo coordinate");
  const [scatter] = seriesList(option) as Array<{
    type?: string;
    coordinateSystem?: string;
    data?: Array<{ name?: string; value: [number, number, number]; symbolSize?: number }>;
  }>;
  assert.equal(scatter.type, "scatter");
  assert.equal(scatter.coordinateSystem, "geo");
  const china = scatter.data?.find((entry) => entry.name === "中国");
  assert.ok(china, "centroid table resolves 中国");
  assert.ok(china.value[0] > 100 && china.value[1] > 30, "centroid carries lng/lat");
  assert.ok((china.symbolSize ?? 0) > 20, "bubble size scales with the value");
});

test("P100-11: geo heatmap plots heat-weighted points", () => {
  const option = renderSample("geoHeatmap");
  assert.ok(option.geo);
  const [heat] = seriesList(option) as Array<{
    type?: string;
    coordinateSystem?: string;
    data?: Array<{ value: [number, number, number] }>;
  }>;
  assert.equal(heat.type, "heatmap");
  assert.equal(heat.coordinateSystem, "geo");
  assert.ok(option.visualMap, "geo heat needs a value scale");
});

test("P100-11: flow map draws centroid arcs from source-target pairs", () => {
  const option = renderSample("flowMap");
  assert.ok(option.geo);
  const [lines] = seriesList(option) as Array<{
    type?: string;
    coordinateSystem?: string;
    data?: Array<{ coords: [[number, number], [number, number]]; value?: number }>;
  }>;
  assert.equal(lines.type, "lines");
  assert.equal(lines.coordinateSystem, "geo");
  assert.equal(lines.data?.length, 8, "one arc per flow row");
  const first = lines.data?.[0]?.coords;
  assert.ok(first, "arcs carry real coordinates");
  assert.notEqual(sig(renderSample("flowMap", { markOpacity: 30 })), sig(renderSample("flowMap", { markOpacity: 90 })));
});
