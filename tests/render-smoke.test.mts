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
