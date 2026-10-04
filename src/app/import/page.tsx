"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import { ArrowRight, Upload, CheckCircle2 } from "lucide-react";

type Row = Record<string, string>;
type ParsedEntry = { title: string; amount: number; date: string; rawIndex: number };

const DATE_HINTS = ["תאריך עסקה", "תאריך רכישה", "תאריך חיוב", "תאריך"];
const TITLE_HINTS = ["שם בית העסק", "בית עסק", "שם בית עסק", "תיאור", "פירוט", "שם העסק"];
const AMOUNT_HINTS = ["סכום חיוב", "סכום עסקה", "סכום לחיוב", "סכום", "סכום בש\"ח"];

function guessColumn(headers: string[], hints: string[]): string {
  for (const hint of hints) {
    const match = headers.find((h) => h.trim() === hint);
    if (match) return match;
  }
  for (const hint of hints) {
    const match = headers.find((h) => h.includes(hint));
    if (match) return match;
  }
  return "";
}

// תומך בפורמטים נפוצים בייצוא ישראלי: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, גרסאות
// עם שנה דו-ספרתית, וגם YYYY-MM-DD. קובץ Max למשל משתמש ב-DD-MM-YYYY עם מקפים.
function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `20${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// מסיר סימן ₪, פסיקים, רווחים וכו', ולוקח ערך מוחלט (חיוב באשראי תמיד מוצג כהוצאה חיובית כאן).
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n);
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1255">("utf-8");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [dateCol, setDateCol] = useState("");
  const [titleCol, setTitleCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [category, setCategory] = useState<"הוצאות" | "הכנסות">("הוצאות");
  const [subcategory, setSubcategory] = useState("Max");
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(
    null
  );
  const [submitError, setSubmitError] = useState("");

  // המרת תא גולמי שמוחזר מ-read-excel-file (מספר / Date / מחרוזת / null) למחרוזת אחידה,
  // כדי שהמשך העיבוד (guessColumn, parseDate, parseAmount) יוכל להתייחס לכל השורות
  // כ-Row (Record<string,string>) בלי קשר למקור (CSV או Excel).
  function cellToString(cell: unknown): string {
    if (cell == null) return "";
    if (cell instanceof Date) {
      // בניה "ידנית" מרכיבי התאריך המקומיים (לא toISOString) כדי למנוע היסט יום מ-UTC.
      const y = cell.getFullYear();
      const mo = String(cell.getMonth() + 1).padStart(2, "0");
      const d = String(cell.getDate()).padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
    return String(cell);
  }

  function applyParsedRows(cols: string[], data: Row[]) {
    if (cols.length === 0 || data.length === 0) {
      setParseError("לא הצלחתי לקרוא שורות מהקובץ - ודא שיש בו שורת כותרות ולפחות שורת מידע אחת.");
      setHeaders([]);
      setRows([]);
      return;
    }
    setHeaders(cols);
    setRows(data);
    setDateCol(guessColumn(cols, DATE_HINTS));
    setTitleCol(guessColumn(cols, TITLE_HINTS));
    setAmountCol(guessColumn(cols, AMOUNT_HINTS));
  }

  async function handleFile(file: File) {
    setParseError("");
    setResult(null);
    setFileName(file.name);

    const isExcel =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (isExcel) {
      try {
        const sheetRows = await readSheet(file);
        const [headerRow, ...dataRows] = sheetRows;
        if (!headerRow) {
          setParseError("לא הצלחתי לקרוא שורות מהקובץ - ודא שיש בו שורת כותרות ולפחות שורת מידע אחת.");
          setHeaders([]);
          setRows([]);
          return;
        }
        const cols = headerRow.map((c) => cellToString(c));
        const data: Row[] = dataRows.map((r) => {
          const row: Row = {};
          cols.forEach((col, i) => {
            row[col] = cellToString(r[i]);
          });
          return row;
        });
        applyParsedRows(cols, data);
      } catch {
        setParseError("שגיאה בקריאת קובץ ה-Excel. ודא שזה קובץ .xlsx תקין.");
      }
      return;
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder(encoding).decode(buffer);
    Papa.parse<Row>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => applyParsedRows(res.meta.fields || [], res.data),
      error: () => setParseError("שגיאה בקריאת הקובץ."),
    });
  }

  const entries = useMemo<ParsedEntry[]>(() => {
    if (!dateCol || !titleCol || !amountCol) return [];
    const out: ParsedEntry[] = [];
    rows.forEach((row, i) => {
      const date = parseDate(row[dateCol] || "");
      const amount = parseAmount(row[amountCol] || "");
      const title = (row[titleCol] || "").trim();
      if (date && amount && amount > 0 && title) {
        out.push({ title, amount, date, rawIndex: i });
      }
    });
    return out;
  }, [rows, dateCol, titleCol, amountCol]);

  const invalidCount = rows.length - entries.length;
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  async function submitImport() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subcategory: subcategory.trim() || undefined,
          entries: entries.map((e) => ({ title: e.title, amount: e.amount, date: e.date })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "שגיאה בייבוא");
        return;
      }
      setResult(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={16} /> חזרה לדשבורד
      </Link>

      <div>
        <h1 className="text-xl font-bold">📥 ייבוא הוצאות מקובץ (למשל Max)</h1>
        <p className="text-sm text-slate-500 mt-1">
          הורד מאתר/אפליקציית Max (או כל חברת אשראי אחרת) קובץ היסטוריית עסקאות, בפורמט CSV או
          Excel (.xlsx), והעלה אותו כאן ישירות - אין צורך בהמרה בין הפורמטים.
        </p>
      </div>

      <section className="card p-5 space-y-4">
        <div>
          <label className="label">קידוד הקובץ (רק לקבצי CSV)</label>
          <select
            className="input"
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as "utf-8" | "windows-1255")}
          >
            <option value="utf-8">UTF-8 (ברירת מחדל)</option>
            <option value="windows-1255">Windows-1255 (עברית ישנה) - אם הטקסט מוצג כג׳יבריש</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">לא רלוונטי לקבצי Excel (.xlsx) - הקידוד מזוהה מהקובץ אוטומטית.</p>
        </div>

        <div>
          <label className="label">קובץ CSV או Excel</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {fileName && <p className="text-xs text-slate-400 mt-1">נבחר: {fileName}</p>}
        </div>

        {parseError && <p className="text-sm text-red-600">{parseError}</p>}
      </section>

      {headers.length > 0 && (
        <>
          <section className="card p-5 space-y-4">
            <h2 className="font-bold text-lg">התאמת עמודות</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">עמודת תאריך</label>
                <select className="input" value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                  <option value="">בחר עמודה...</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">עמודת שם בית עסק / תיאור</label>
                <select className="input" value={titleCol} onChange={(e) => setTitleCol(e.target.value)}>
                  <option value="">בחר עמודה...</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">עמודת סכום</label>
                <select className="input" value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                  <option value="">בחר עמודה...</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">קטגוריה לייבוא</label>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "הוצאות" | "הכנסות")}
                >
                  <option value="הוצאות">הוצאות</option>
                  <option value="הכנסות">הכנסות</option>
                </select>
              </div>
              <div>
                <label className="label">תת-קטגוריה (אופציונלי)</label>
                <input
                  className="input"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="לדוגמה: Max"
                />
              </div>
            </div>
          </section>

          {dateCol && titleCol && amountCol && (
            <section className="card p-5 space-y-4">
              <h2 className="font-bold text-lg">תצוגה מקדימה</h2>
              <p className="text-sm text-slate-500">
                נמצאו <span className="font-semibold text-slate-700">{entries.length}</span> תנועות
                תקינות מתוך {rows.length} שורות בקובץ
                {invalidCount > 0 && (
                  <span className="text-amber-600"> ({invalidCount} שורות לא זוהו ודולגו)</span>
                )}
                . סה״כ: <span className="font-semibold text-slate-700">{totalAmount.toLocaleString("he-IL")} ₪</span>
              </p>

              {entries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 px-2">תאריך</th>
                        <th className="py-1.5 px-2">שם</th>
                        <th className="py-1.5 px-2">סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.slice(0, 5).map((e, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2">{e.date}</td>
                          <td className="py-1.5 px-2">{e.title}</td>
                          <td className="py-1.5 px-2">{e.amount.toLocaleString("he-IL")} ₪</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entries.length > 5 && (
                    <p className="text-xs text-slate-400 mt-1">ועוד {entries.length - 5} תנועות...</p>
                  )}
                </div>
              )}

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              {!result ? (
                <button
                  onClick={submitImport}
                  disabled={entries.length === 0 || submitting}
                  className="btn-primary flex items-center gap-2 disabled:opacity-60"
                >
                  <Upload size={16} />
                  {submitting ? "מייבא..." : `ייבוא ${entries.length} תנועות`}
                </button>
              ) : (
                <div className="bg-emerald-50 text-emerald-800 rounded-xl p-4 flex items-start gap-2">
                  <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">הייבוא הושלם</p>
                    <p>
                      נוצרו {result.created} רשומות חדשות
                      {result.skipped > 0 && ` (${result.skipped} דולגו - כבר קיימות)`}.
                    </p>
                    <Link href={`/category/${encodeURIComponent(category)}`} className="underline font-medium">
                      מעבר לעמוד {category}
                    </Link>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
