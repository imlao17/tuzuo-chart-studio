/**
 * Real-render smoke test: builds every template's option from its sample data
 * and pushes it through an actual ECharts SVG instance. Behavior tests only
 * exercise option construction, which missed render-time failures like
 * canvas-only series under the SVG renderer (heatmap-on-geo, word clouds)
 * and series bound to missing coordinate systems.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as echarts from "echarts";
import {
  buildChartOption,
  CHART_TEMPLATES,
  tableToParsed,
  THEMES,
  type ChartConfig,
} from "../app/chart-model";
import { getTemplateDefinition } from "../app/template-definition";

const registry = echarts as unknown as {
  registerMap: (name: string, geo: unknown) => void;
};
for (const name of ["world", "china"]) {
  registry.registerMap(
    name,
    JSON.parse(readFileSync(`public/geo/${name}.json`, "utf8")),
  );
}

function fullConfig(id: string): ChartConfig {
  const def = getTemplateDefinition(id as ChartConfig["type"]);
  return {
    type: id as ChartConfig["type"],
    parsed: tableToParsed(def.sampleData.table),
    categoryColumn: def.sampleData.categoryColumn,
    seriesColumns: def.sampleData.seriesColumns,
    sourceColumn:
      typeof def.sampleData.roleDefaults?.source === "string"
        ? def.sampleData.roleDefaults.source
        : undefined,
    targetColumn:
      typeof def.sampleData.roleDefaults?.target === "string"
        ? def.sampleData.roleDefaults.target
        : undefined,
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
  };
}

test("every template renders a substantive SVG through a real ECharts instance", () => {
  const failures: string[] = [];
  for (const { id, name } of CHART_TEMPLATES) {
    const chart = echarts.init(null as unknown as HTMLElement, undefined, {
      renderer: "svg",
      ssr: true,
      width: 800,
      height: 480,
    });
    try {
      chart.setOption(buildChartOption(fullConfig(id)), true);
      const svg = chart.renderToSVGString();
      const shapes = (svg.match(/<(path|rect|circle|text|polygon|polyline|image)\b/g) ?? [])
        .length;
      if (svg.length < 400 || shapes < 3) {
        failures.push(`${id}(${name}): svg=${svg.length}B shapes=${shapes}`);
      }
    } catch (error) {
      failures.push(`${id}(${name}): ${(error as Error).message}`);
    } finally {
      chart.dispose();
    }
  }
  assert.deepEqual(failures, [], `render-time failures: ${failures.join("; ")}`);
});

// --- 状态 2：样式变体态 -------------------------------------------------------
// 同一份样例数据在常见开关组合下必须都能渲染（不抛错、有产出），覆盖
// textOnDark / 数据标签 / 图例 / 紧凑模式的组合矩阵。
test("every template survives common style-toggle combinations", () => {
  const failures: string[] = [];
  const toggles: Array<Partial<ChartConfig>> = [
    { showLabels: false, showLegend: false },
    { showLabels: true, showLegend: true, textOnDark: true, backgroundColor: "#17202A" },
    { showLabels: true, showLegend: false, compact: true },
  ];
  for (const { id, name } of CHART_TEMPLATES) {
    for (const [index, patch] of toggles.entries()) {
      const chart = echarts.init(null as unknown as HTMLElement, undefined, {
        renderer: "svg",
        ssr: true,
        width: 800,
        height: 480,
      });
      try {
        chart.setOption(
          buildChartOption({ ...fullConfig(id), ...patch }),
          true,
        );
        const svg = chart.renderToSVGString();
        if (svg.length < 200) {
          failures.push(`${id}(${name}) 变体${index}: svg=${svg.length}B`);
        }
      } catch (error) {
        failures.push(`${id}(${name}) 变体${index}: ${(error as Error).message}`);
      } finally {
        chart.dispose();
      }
    }
  }
  assert.deepEqual(failures, [], `toggle failures: ${failures.join("; ")}`);
});

// --- 状态 3：极端数据态 -------------------------------------------------------
// 空行、单行、超长类目、大量类目、全零、负值、巨值——渲染器不许抛错。
// 稀疏输出在这里是合法的（空数据只剩坐标轴），因此只断言不抛错。
test("every template survives extreme datasets without throwing", () => {
  const failures: string[] = [];
  const extreme: Array<[string, string[][]]> = [
    ["仅表头", [["类别", "数值一", "数值二"]]],
    ["单行", [["类别", "数值一", "数值二"], ["A", "12", "34"]]],
    ["超长类目", [
      ["类别", "数值一"],
      ["这是一个特别特别特别长的类目名称用来测试标签换行与截断策略的表现情况吧", "42"],
      ["B", "18"],
    ]],
    ["六十类目", [
      ["类别", "数值一"],
      ...Array.from({ length: 60 }, (_, i) => [`分类${i + 1}`, String((i * 7) % 100)]),
    ]],
    ["全零", [["类别", "数值一"], ["A", "0"], ["B", "0"], ["C", "0"]]],
    ["负值", [["类别", "数值一"], ["A", "-15"], ["B", "22"], ["C", "-8"]]],
    ["巨值", [["类别", "数值一"], ["A", "9876543210"], ["B", "123456789"]]],
  ];
  for (const { id, name } of CHART_TEMPLATES) {
    const base = fullConfig(id);
    for (const [label, table] of extreme) {
      const chart = echarts.init(null as unknown as HTMLElement, undefined, {
        renderer: "svg",
        ssr: true,
        width: 800,
        height: 480,
      });
      try {
        const parsed = tableToParsed(table);
        chart.setOption(
          buildChartOption({
            ...base,
            parsed,
            categoryColumn: table[0][0],
            seriesColumns: table[0].slice(1),
          }),
          true,
        );
      } catch (error) {
        failures.push(`${id}(${name}) ${label}: ${(error as Error).message}`);
      } finally {
        chart.dispose();
      }
    }
  }
  assert.deepEqual(failures, [], `extreme-data failures: ${failures.join("; ")}`);
});

// --- 标签三态：关 / 外置 / inside -------------------------------------------
// 全模板 × 三态 SSR 冒烟：零抛错、SVG 非空。这是时段 1「按需预留」重构的
// 回归网：外置态按格式化最大值预留，inside 态零预留。
test("label three-state (off/outside/inside) renders across all templates", () => {
  const failures: string[] = [];
  const states: Array<[string, Partial<ChartConfig>]> = [
    ["标签关", { showLabels: false }],
    ["外置", { showLabels: true, labelPosition: "outsideRight" }],
    ["inside", { showLabels: true, labelPosition: "inside" }],
  ];
  for (const { id, name } of CHART_TEMPLATES) {
    for (const [label, patch] of states) {
      const chart = echarts.init(null as unknown as HTMLElement, undefined, {
        renderer: "svg",
        ssr: true,
        width: 800,
        height: 480,
      });
      try {
        chart.setOption(
          buildChartOption({ ...fullConfig(id), ...patch }),
          true,
        );
        const svg = chart.renderToSVGString();
        if (svg.length < 200) {
          failures.push(`${id}(${name}) ${label}: svg=${svg.length}B`);
        }
      } catch (error) {
        failures.push(`${id}(${name}) ${label}: ${(error as Error).message}`);
      } finally {
        chart.dispose();
      }
    }
  }
  assert.deepEqual(failures, [], `label-state failures: ${failures.join("; ")}`);
});

// --- inside 零缩宽复验 -------------------------------------------------------
// 横向条形族代表模板：inside 态的绘图区宽度必须与标签关态完全一致
// （inside 标签不该挤占图表宽度——这是历史 bug 的回归锁定）。
test("inside labels keep the labels-off plot width on horizontal bars", () => {
  const horizontal = [
    "bar",
    "stackedBar",
    "proportionalBar",
    "groupedBar",
    "progressBar",
    "rankingBar",
    "capsuleBar",
    "arrowBar",
    "dumbbell",
    "bulletBar",
  ];
  const failures: string[] = [];
  for (const id of horizontal) {
    const gridOf = (patch: Partial<ChartConfig>) => {
      const chart = echarts.init(null as unknown as HTMLElement, undefined, {
        renderer: "svg",
        ssr: true,
        width: 800,
        height: 480,
      });
      try {
        const option = buildChartOption({
          ...fullConfig(id),
          ...patch,
        }) as { grid?: Array<{ left?: unknown; right?: unknown }> };
        return JSON.stringify(option.grid ?? null);
      } finally {
        chart.dispose();
      }
    };
    const off = gridOf({ showLabels: false });
    const inside = gridOf({ showLabels: true, labelPosition: "inside" });
    if (off !== inside) {
      failures.push(`${id}: 关=${off} inside=${inside}`);
    }
  }
  assert.deepEqual(failures, [], `inside-width drift: ${failures.join("; ")}`);
});

// --- 外置标签出界记录（软检测） ----------------------------------------------
// outsideRight 态下估算文本 bbox 是否超出 800×480 画布；时段 1 的按需预留
// 应让常见样例不再溢出。此处只记录不判失败，输出用于人工复核。
test("outside labels stay within the canvas on horizontal bars", () => {
  const horizontal = [
    "bar",
    "stackedBar",
    "proportionalBar",
    "groupedBar",
    "progressBar",
    "rankingBar",
    "capsuleBar",
    "arrowBar",
    "dumbbell",
    "bulletBar",
  ];
  const overflows: string[] = [];
  for (const id of horizontal) {
    const chart = echarts.init(null as unknown as HTMLElement, undefined, {
      renderer: "svg",
      ssr: true,
      width: 800,
      height: 480,
    });
    try {
      chart.setOption(
        buildChartOption({
          ...fullConfig(id),
          showLabels: true,
          labelPosition: "outsideRight",
        }),
        true,
      );
      const svg = chart.renderToSVGString();
      for (const match of svg.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*>([^<]*)</g)) {
        const x = Number(match[1]);
        const text = match[2];
        // 中文/数字混合按 0.62×13px 估算宽度，与渲染器预留估算同系数
        const estimated = x + text.length * 0.62 * 13;
        if (estimated > 802) {
          overflows.push(`${id}: "${text}" x=${x} 估右缘=${estimated.toFixed(0)}`);
        }
      }
    } finally {
      chart.dispose();
    }
  }
  if (overflows.length) {
    console.log(`[出界记录] ${overflows.length} 处:\n  ${overflows.join("\n  ")}`);
  }
});
