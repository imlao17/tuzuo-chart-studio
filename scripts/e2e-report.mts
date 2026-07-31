// 端到端实测报告（Node 层）：覆盖测试一（各图表生成）+ 测试二（数据一致性）。
// 依据：README 定位 + design-qa 交互验收 + gap-analysis 第 9 节验收标准。
// 直接对 20 模板跑 buildChartOption，逐项报告，不做断言失败退出——产出一份报告。
//
// Run: npx tsx scripts/e2e-report.mts
import {
  buildChartOption,
  CHART_TEMPLATES,
  tableToParsed,
  THEMES,
  type ChartType,
} from "../app/chart-model";
import { getTemplateDefinition } from "../app/template-definition";

const ALL = CHART_TEMPLATES.map((t) => t.id);

function renderSample(type: ChartType) {
  const sd = getTemplateDefinition(type).sampleData;
  return buildChartOption({
    type,
    parsed: tableToParsed(sd.table),
    categoryColumn: sd.categoryColumn,
    seriesColumns: sd.seriesColumns,
    title: "测试", subtitle: "", width: 960, height: 540,
    margins: { top: 28, right: 32, bottom: 36, left: 38 },
    theme: THEMES[0], primaryColor: THEMES[0].colors[0], secondaryColor: THEMES[0].colors[1],
    backgroundColor: "#ffffff", transparent: false, showLabels: true, showLegend: true,
    showGrid: true, smooth: false, fontSize: 13,
  });
}

const seriesList = (o: { series?: unknown }) =>
  Array.isArray(o.series) ? o.series : o.series ? [o.series] : [];

console.log("═══════════════════════════════════════════════════════════");
console.log(" 测试一：各图表生成情况（每个模板加载示例数据后渲染）");
console.log("═══════════════════════════════════════════════════════════");
const results: { type: ChartType; ok: boolean; seriesCount: number; seriesTypes: string; dataPoints: number; issue?: string }[] = [];
for (const type of ALL) {
  try {
    const opt = renderSample(type);
    const list = seriesList(opt) as { type?: string; data?: unknown[] }[];
    const seriesTypes = list.map((s) => s.type).join("/");
    // count total data points across series
    let points = 0;
    for (const s of list) {
      if (Array.isArray(s.data)) points += s.data.length;
    }
    const ok = list.length > 0 && points > 0;
    results.push({ type, ok, seriesCount: list.length, seriesTypes, dataPoints: points, issue: ok ? undefined : "无 series 或无数据点" });
  } catch (e) {
    results.push({ type, ok: false, seriesCount: 0, seriesTypes: "", dataPoints: 0, issue: String(e).slice(0, 80) });
  }
}
for (const r of results) {
  const flag = r.ok ? "✓" : "✗";
  console.log(`${flag} ${r.type.padEnd(20)} series=${r.seriesCount} 类型=${r.seriesTypes.padEnd(18)} 数据点=${r.dataPoints}${r.issue ? "  ⚠ " + r.issue : ""}`);
}
const pass1 = results.filter((r) => r.ok).length;
console.log(`\n小结：${pass1}/${ALL.length} 模板渲染出非空图表`);

console.log("\n═══════════════════════════════════════════════════════════");
console.log(" 测试二：数据端 → 图表端 的数据一致性");
console.log("═══════════════════════════════════════════════════════════");

// T2.1 改一个数据单元格的值 → option 的 series.data 变化（design-qa: 128→256）
console.log("\nT2.1 改单元格值（128 → 256）→ 图表 series.data 是否变化");
let t21Pass = 0;
for (const type of ALL) {
  const sd = getTemplateDefinition(type).sampleData;
  const before = renderSample(type);
  // clone table, change first numeric data cell of first data row
  const table = sd.table.map((r) => [...r]);
  const valueColIdx = Math.max(1, sd.table[0].indexOf(sd.seriesColumns[0]));
  const orig = table[1][valueColIdx];
  table[1][valueColIdx] = String(Number(orig) * 2);
  const after = buildChartOption({
    type, parsed: tableToParsed(table), categoryColumn: sd.categoryColumn, seriesColumns: sd.seriesColumns,
    title:"测试", subtitle:"", width:960, height:540, margins:{top:28,right:32,bottom:36,left:38},
    theme: THEMES[0], primaryColor: THEMES[0].colors[0], secondaryColor: THEMES[0].colors[1],
    backgroundColor:"#fff", transparent:false, showLabels:true, showLegend:true, showGrid:true, smooth:false, fontSize:13,
  });
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (changed) t21Pass += 1;
  else console.log(`  ✗ ${type}: 改值后 option 未变化`);
}
console.log(`  小结：${t21Pass}/${ALL.length} 模板改值后 option 有变化`);

// T2.2 改分类列名 → 类别标签变化（取分组柱状图为代表，检查 xAxis.data 含新列名）
console.log("\nT2.2 改分类列名（一月 → January）→ 图表类别标签是否更新");
{
  const sd = getTemplateDefinition("groupedColumn").sampleData;
  const table = sd.table.map((r) => [...r]);
  table[1][0] = "January";
  const opt = buildChartOption({
    type: "groupedColumn", parsed: tableToParsed(table), categoryColumn: sd.categoryColumn, seriesColumns: sd.seriesColumns,
    title:"", subtitle:"", width:960, height:540, margins:{top:28,right:32,bottom:36,left:38},
    theme: THEMES[0], primaryColor: THEMES[0].colors[0], secondaryColor: THEMES[0].colors[1],
    backgroundColor:"#fff", transparent:false, showLabels:true, showLegend:true, showGrid:true, smooth:false, fontSize:13,
  });
  const cats = (opt.xAxis as { data?: string[] }).data ?? [];
  const ok = cats.includes("January");
  console.log(`  ${ok ? "✓" : "✗"} 分组柱状图类别标签含 "January"：${ok ? "是" : "否"}（类别=${cats.join(",")}）`);
}

// T2.3 增删数据行 → 数据点数相应增减（分组柱状图，删一行 → series.data 长度减 1）
console.log("\nT2.3 删一行数据 → 图表数据点是否相应减少");
{
  const sd = getTemplateDefinition("groupedColumn").sampleData;
  const before = renderSample("groupedColumn");
  const beforeLen = (seriesList(before)[0] as { data: unknown[] }).data.length;
  const table = sd.table.map((r) => [...r]);
  table.splice(1, 1); // delete first data row
  const after = buildChartOption({
    type: "groupedColumn", parsed: tableToParsed(table), categoryColumn: sd.categoryColumn, seriesColumns: sd.seriesColumns,
    title:"", subtitle:"", width:960, height:540, margins:{top:28,right:32,bottom:36,left:38},
    theme: THEMES[0], primaryColor: THEMES[0].colors[0], secondaryColor: THEMES[0].colors[1],
    backgroundColor:"#fff", transparent:false, showLabels:true, showLegend:true, showGrid:true, smooth:false, fontSize:13,
  });
  const afterLen = (seriesList(after)[0] as { data: unknown[] }).data.length;
  const ok = afterLen === beforeLen - 1;
  console.log(`  ${ok ? "✓" : "✗"} 删一行后数据点 ${beforeLen} → ${afterLen}（期望 ${beforeLen - 1}）`);
}

console.log("\n报告结束。");
process.exit(0);
