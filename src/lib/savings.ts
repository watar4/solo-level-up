import type { SavingsEntry, SavingsSource } from '../types';

// ── Real-world money → game data ───────────────────────────────────────
//
// Neither ゆうちょ銀行 nor 楽天カード exposes a public personal API (bank
// APIs are contract-gated to registered 電子決済等代行業者), so ingestion is
// manual entry + CSV import. Both services offer CSV statement downloads:
//   - ゆうちょダイレクト/通帳アプリ → 入出金明細CSV (deposits = saving)
//   - 楽天e-NAVI → 利用明細CSV (card usage = spending vs. monthly budget)
// The importer sniffs the header row to pick a format; unknown headers fall
// back to a generic date/amount/memo layout.

export interface ParsedRow {
  date: string;    // YYYY-MM-DD
  amount: number;  // yen. saving: + = deposit, − = withdrawal. spending: + = spent.
  memo: string;
  kind: 'saving' | 'spending';
}

export interface ParsedStatement {
  format: 'yucho-csv' | 'rakuten-csv' | 'generic';
  rows: ParsedRow[];
  skipped: number; // rows that didn't parse (blank, header repeats, totals…)
}

// ── Encoding-tolerant file decode ──────────────────────────────────────
// Bank CSVs in Japan are frequently Shift_JIS; newer exports are UTF-8.
// Try strict UTF-8 first, fall back to shift_jis.
export function decodeCsvBuffer(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

// ── Minimal CSV reader (quoted fields, embedded commas/newlines) ───────
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

// ── Field normalisers ──────────────────────────────────────────────────

// "2026/07/03", "2026-07-03", "20260703", "2026年7月3日" → "2026-07-03"
export function normalizeDate(raw: string): string | null {
  const s = raw.trim().replace(/[年月]/g, '/').replace(/日/g, '');
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) {
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  }
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "1,234", "￥1,234", "1234円", "-500" → number. null when not numeric.
export function normalizeAmount(raw: string): number | null {
  const s = raw.trim().replace(/[,，￥¥円\s]/g, '').replace(/[−ー]/, '-');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Header sniffing ────────────────────────────────────────────────────

function findHeaderRow(rows: string[][]): { index: number; header: string[] } | null {
  // Bank CSVs often carry preamble lines (account info) before the header.
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].join(' ');
    if (/利用日|取扱日|取引日|年月日|日付|お預り|お支払|利用金額/.test(joined)) {
      return { index: i, header: rows[i].map((h) => h.trim()) };
    }
  }
  return null;
}

function columnIndex(header: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const idx = header.findIndex((h) => p.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ── Format-specific parsing ────────────────────────────────────────────

export function parseStatementCsv(text: string): ParsedStatement {
  const rows = parseCsvText(text);
  const headerInfo = findHeaderRow(rows);

  if (!headerInfo) {
    return parseGeneric(rows);
  }

  const { index, header } = headerInfo;
  const body = rows.slice(index + 1);
  const joined = header.join(' ');

  // 楽天カード利用明細: 利用日 / 利用店名・商品名 / 利用金額 …
  if (/利用日/.test(joined) && /利用店名|利用金額/.test(joined)) {
    return parseRakuten(header, body);
  }
  // ゆうちょ入出金明細: 取扱日(or 年月日) / お預り金額(受入) / お支払金額(払出) …
  return parseYucho(header, body);
}

function parseRakuten(header: string[], body: string[][]): ParsedStatement {
  const dateIdx = columnIndex(header, [/利用日/]);
  const memoIdx = columnIndex(header, [/利用店名|商品名/, /摘要/]);
  const amountIdx = columnIndex(header, [/^利用金額/, /支払総額/, /金額/]);
  const rowsOut: ParsedRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const date = dateIdx >= 0 ? normalizeDate(r[dateIdx] ?? '') : null;
    const amount = amountIdx >= 0 ? normalizeAmount(r[amountIdx] ?? '') : null;
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    rowsOut.push({
      date,
      amount, // negative rows = refunds; they net against the month's spend
      memo: (memoIdx >= 0 ? r[memoIdx] : '')?.trim() || '楽天カード利用',
      kind: 'spending',
    });
  }
  return { format: 'rakuten-csv', rows: rowsOut, skipped };
}

function parseYucho(header: string[], body: string[][]): ParsedStatement {
  const dateIdx = columnIndex(header, [/取扱日|取引日|年月日|日付/]);
  const depositIdx = columnIndex(header, [/お?預り金額|預入金額|受入金額|入金/]);
  const withdrawIdx = columnIndex(header, [/お?支払金額|払出金額|出金/]);
  const memoIdx = columnIndex(header, [/詳細|摘要|取扱内容|内容/]);
  const singleAmountIdx =
    depositIdx < 0 && withdrawIdx < 0 ? columnIndex(header, [/金額/]) : -1;

  const rowsOut: ParsedRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const date = dateIdx >= 0 ? normalizeDate(r[dateIdx] ?? '') : null;
    if (!date) {
      skipped++;
      continue;
    }
    let amount: number | null = null;
    if (singleAmountIdx >= 0) {
      amount = normalizeAmount(r[singleAmountIdx] ?? '');
    } else {
      const dep = depositIdx >= 0 ? normalizeAmount(r[depositIdx] ?? '') : null;
      const wd = withdrawIdx >= 0 ? normalizeAmount(r[withdrawIdx] ?? '') : null;
      if (dep !== null && dep !== 0) amount = Math.abs(dep);
      else if (wd !== null && wd !== 0) amount = -Math.abs(wd);
    }
    if (amount === null || amount === 0) {
      skipped++;
      continue;
    }
    rowsOut.push({
      date,
      amount,
      memo: (memoIdx >= 0 ? r[memoIdx] : '')?.trim() || 'ゆうちょ入出金',
      kind: 'saving',
    });
  }
  return { format: 'yucho-csv', rows: rowsOut, skipped };
}

// Unknown layout: assume date, amount, memo in the first three columns.
function parseGeneric(rows: string[][]): ParsedStatement {
  const rowsOut: ParsedRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = normalizeDate(r[0] ?? '');
    const amount = normalizeAmount(r[1] ?? '');
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    rowsOut.push({ date, amount, memo: (r[2] ?? '').trim() || 'インポート', kind: 'saving' });
  }
  return { format: 'generic', rows: rowsOut, skipped };
}

// ── Dedup fingerprint ──────────────────────────────────────────────────
// djb2 over the identifying fields; stable across imports of the same file.
export function entryHash(row: Pick<ParsedRow, 'date' | 'amount' | 'memo' | 'kind'>): string {
  const key = `${row.date}|${row.amount}|${row.memo}|${row.kind}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

// ── Aggregations ───────────────────────────────────────────────────────

export function savingsTotal(entries: SavingsEntry[]): number {
  return entries
    .filter((e) => e.kind === 'saving')
    .reduce((sum, e) => sum + e.amount, 0);
}

export function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

export function thisMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthlyTotals(
  entries: SavingsEntry[],
  kind: 'saving' | 'spending'
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== kind) continue;
    const k = monthKey(e.date);
    out.set(k, (out.get(k) ?? 0) + e.amount);
  }
  return out;
}

export function monthSpending(entries: SavingsEntry[], month: string): number {
  return entries
    .filter((e) => e.kind === 'spending' && monthKey(e.date) === month)
    .reduce((sum, e) => sum + e.amount, 0);
}

export const SOURCE_LABEL: Record<SavingsSource, string> = {
  manual: '手動',
  'yucho-csv': 'ゆうちょCSV',
  'rakuten-csv': '楽天カードCSV',
};

export function formatYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}
