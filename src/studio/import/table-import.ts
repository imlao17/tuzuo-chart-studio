/**
 * Data import helpers: fetch a delimiter table from a public URL and parse
 * Excel workbooks entirely in the browser (no network round-trip for xlsx).
 */
import * as XLSX from "xlsx";
import { parseDelimitedTable } from "../../../app/chart-model";

export type ImportTableResult = {
  table: string[][];
  source: string;
};

/** Fetch a remote CSV/TSV/text table. Throws with a readable message. */
export async function fetchTableFromUrl(url: string): Promise<ImportTableResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("链接格式无效，请输入完整的 http(s) 链接");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("仅支持 http(s) 链接");
  }

  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch {
    throw new Error("链接无法访问，请检查地址或网络");
  }
  if (!response.ok) {
    throw new Error(`链接返回 ${response.status}，请确认链接可公开访问`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (/xlsx|xls|spreadsheet/i.test(contentType) || /\.xlsx?(\?|$)/i.test(parsedUrl.pathname)) {
    const buffer = await response.arrayBuffer();
    return { table: parseWorkbook(buffer), source: url };
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error("链接内容为空");
  }
  if (text.trimStart().startsWith("<")) {
    throw new Error("链接返回的是网页而非表格数据，请使用直链或导出的 CSV 地址");
  }
  return { table: parseDelimitedTable(text), source: url };
}

/** Parse an xlsx/xls binary (ArrayBuffer) into a string table, first sheet. */
export function parseWorkbook(buffer: ArrayBuffer): string[][] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new Error("无法读取该工作簿文件");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("工作簿中没有工作表");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  const table = rows.map((row) =>
    (row as unknown[]).map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
  );
  if (!table.length) throw new Error("工作表为空");
  return table;
}
