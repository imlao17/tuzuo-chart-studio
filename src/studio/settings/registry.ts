export const SETTINGS_SECTION_META = {
  data: {
    id: "data",
    title: "数据字段",
    keywords: "字段 系列 选择 绑定 数据 示例 表格 分类 数值 来源 去向",
  },
  colors: {
    id: "colors",
    title: "配色",
    keywords: "颜色 调色板 自定义 品牌 系列 主题 色板 覆盖 色值",
  },
  marks: {
    id: "marks",
    title: "线条、数据点与面积",
    keywords:
      "柱宽 圆角 透明度 平滑 点大小 样式 线宽 面积 排序 堆叠 间距 参考线 趋势线",
  },
  labels: {
    id: "labels",
    title: "数据标签",
    keywords:
      "数值 位置 字号 显示 颜色 对齐 粗体 斜体 样式 内容 排序 起始角 内径",
  },
  xAxis: {
    id: "xAxis",
    title: "X 轴",
    keywords: "横轴 分类轴 标题 标签 旋转 样式 粗体 斜体 颜色 字号",
  },
  yAxis: {
    id: "yAxis",
    title: "Y 轴",
    keywords:
      "纵轴 数值轴 标题 范围 最小 最大 网格线 样式 粗体 斜体 颜色 字号",
  },
  legend: {
    id: "legend",
    title: "图例与交互",
    keywords:
      "位置 对齐 居中 靠左 靠右 靠上 靠下 提示 悬停 筛选 显示 tooltip",
  },
  numbers: {
    id: "numbers",
    title: "数字格式",
    keywords: "小数 千分位 前缀 后缀 单位 金额 百分比",
  },
  annotations: {
    id: "annotations",
    title: "图形标注",
    keywords: "标注 注释 文字 箭头 矩形 高亮",
  },
} as const;

export type SettingsSectionId = keyof typeof SETTINGS_SECTION_META;

export const DEFAULT_SETTINGS_OPEN: Record<SettingsSectionId, boolean> = {
  data: true,
  colors: true,
  marks: false,
  labels: false,
  xAxis: false,
  yAxis: false,
  legend: false,
  numbers: false,
  annotations: true,
};

export function settingsSectionMatches(id: SettingsSectionId, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const meta = SETTINGS_SECTION_META[id];
  return `${meta.title} ${meta.keywords}`.toLowerCase().includes(normalized);
}
