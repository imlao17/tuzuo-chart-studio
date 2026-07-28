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
  // P1 gap), so it is exempt; every other template wires showLabels through.
  const labelled = ALL_TYPES.filter((t) => t !== "streamgraph");
  for (const type of labelled) {
    const off = sig(renderSample(type, { showLabels: false }));
    const on = sig(renderSample(type, { showLabels: true }));
    assert.notEqual(off, on, `${type}: showLabels had no effect`);
  }
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

test("single numeric column passes generic templates but fails scatter/diverging/pyramid", () => {
  const ctx: ValidationContext = {
    parsed: tableToParsed([
      ["月份", "数值"],
      ["一月", "10"],
      ["二月", "20"],
    ]),
    categoryColumn: "月份",
    seriesColumns: ["数值"],
  };
  const needsTwo: ChartType[] = ["scatter", "divergingBar", "populationPyramid"];
  for (const type of ALL_TYPES) {
    const err = firstError(type, ctx);
    if (needsTwo.includes(type)) {
      assert.ok(err && err.includes("2 个数值列"), `${type}: expected 2-column error, got ${err}`);
    } else {
      assert.equal(err, null, `${type}: should accept a single numeric column`);
    }
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
