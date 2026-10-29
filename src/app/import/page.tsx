"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import { ArrowRight, Upload, CheckCircle2 } from "lucide-react";

type Row = Record<string, string>;
type Kind = "הוצאות" | "הכנסות";
type ParsedEntry = { title: string; amount: number; date: string; rawIndex: number; kind: Kind };
type Mode = "sign" | Kind;

const DATE_HINTS = ["תאריך עסקה", "תאריך רכישה", "תאריך חיוב", "תאריך"];
const TITLE_HINTS = ["שם בית העסק", "בית עסק", "שם בית עסק", "תיאור", "פירוט", "שם העסק"];
const AMOUNT_HINTS = ["סכום חיוב", "סכום עסקה", "סכום לחיוב", "סכום", "סכום בש\"ח", "חובה", "סכום בחובה"];
const CREDIT_HINTS = ["זכות", "סכום בזכות", "הפקדה"];

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

// מסיר סימן ₪, פסיקים, רווחים וכו' ומחזיר ערך עם סימן. שלילי מזוהה לפי "-" בתחילה או בסוף
// ("12,000-" כמו בקבצי בנק מסוימים) או סוגריים "(12,000)".
function parseSigned(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const negative = /^[\s₪]*[-−–]/.test(s) || /[-−–]\s*$/.test(s) || /^\(.*\)$/.test(s);
  const digits = s.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
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
  const [creditCol, setCreditCol] = useState("");
  const [mode, setMode] = useState<Mode>("הוצאות");
  const [flipSign, setFlipSign] = useState(false);
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
    const amountGuess = guessColumn(cols, AMOUNT_HINTS);
    setAmountCol(amountGuess);
    // קובץ עם עמודת "זכות" נפרדת (בנק): החובה היא הוצאה והזכות היא הכנסה
    const creditGuess = guessColumn(cols, CREDIT_HINTS);
    setCreditCol(creditGuess && creditGuess !== amountGuess ? creditGuess : "");
    // אם בעמודת הסכום יש גם סכומים שליליים וגם חיוביים - מזהים הוצאה/הכנסה לפי הסימן
    const signs = amountGuess ? data.map((r) => parseSigned(r[amountGuess] || "")).filter((n): n is number => !!n) : [];
    setMode(signs.some((n) => n < 0) && signs.some((n) => n > 0) ? "sign" : "הוצאות");
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
      const title = (row[titleCol] || "").trim();
      if (!date || !title) return;
      const main = parseSigned(row[amountCol] || "");
      let kind: Kind | null = null;
      let amount = 0;
      if (creditCol) {
        // עמודות נפרדות: זכות = הכנסה, חובה = הוצאה
        const credit = parseSigned(row[creditCol] || "");
        if (credit) {
          kind = "הכנסות";
          amount = Math.abs(credit);
        } else if (main) {
          kind = "הוצאות";
          amount = Math.abs(main);
        }
      } else if (main) {
        amount = Math.abs(main);
        if (mode === "sign") {
          const negative = flipSign ? main > 0 : main < 0;
          kind = negative ? "הוצאות" : "הכנסות";
        } else {
          kind = mode;
        }
      }
      if (kind && amount > 0) out.push({ title, amount, date, rawIndex: i, kind });
    });
    return out;
  }, [rows, dateCol, titleCol, amountCol, creditCol, mode, flipSign]);

  const invalidCount = rows.length - entries.length;
  const expenseTotal = entries.filter((e) => e.kind === "הוצאות").reduce((t, e) => t + e.amount, 0);
  const incomeTotal = entries.filter((e) => e.kind === "הכנסות").reduce((t, e) => t + e.amount, 0);
  const expenseCount = entries.filter((e) => e.kind === "הוצאות").length;
  const incomeCount = entries.length - expenseCount;

  async function submitImport() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcategory: subcategory.trim() || undefined,
          entries: entries.map((e) => ({ title: e.title, amount: e.amount, date: e.date, category: e.kind })),
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
        <h1 className="text-xl font-bold">📥 ייבוא הוצאות והכנסות מקובץ (בנק או אשראי)</h1>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className="label">{creditCol ? "עמודת חובה (הוצאה)" : "עמודת סכום"}</label>
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
                <label className="label">עמודת זכות / הכנסה (אם יש בקובץ)</label>
                <select className="input" value={creditCol} onChange={(e) => setCreditCol(e.target.value)}>
                  <option value="">אין - עמודה אחת של סכום</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              {!creditCol && (
                <div>
                  <label className="label">איך לזהות הוצאה והכנסה</label>
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                    <option value="sign">לפי הסימן: שלילי = הוצאה, חיובי = הכנסה</option>
                    <option value="הוצאות">הכל הוצאות</option>
                    <option value="הכנסות">הכל הכנסות</option>
                  </select>
                  {mode === "sign" && (
                    <label className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                      <input type="checkbox" checked={flipSign} onChange={(e) => setFlipSign(e.target.checked)} />
                      הפוך: חיובי = הוצאה, שלילי = הכנסה
                    </label>
                  )}
                </div>
              )}
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
                .
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-red-50 px-3 py-2 text-sm">
                  <p className="text-xs text-red-700">הוצאות · {expenseCount}</p>
                  <p className="font-bold text-red-700">{expenseTotal.toLocaleString("he-IL")} ₪</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <p className="text-xs text-emerald-700">הכנסות · {incomeCount}</p>
                  <p className="font-bold text-emerald-700">{incomeTotal.toLocaleString("he-IL")} ₪</p>
                </div>
              </div>

              {entries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 px-2">תאריך</th>
                        <th className="py-1.5 px-2">שם</th>
                        <th className="py-1.5 px-2">סוג</th>
                        <th className="py-1.5 px-2">סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.slice(0, 5).map((e, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2">{e.date}</td>
                          <td className="py-1.5 px-2">{e.title}</td>
                          <td className={`py-1.5 px-2 ${e.kind === "הכנסות" ? "text-emerald-700" : "text-red-700"}`}>{e.kind === "הכנסות" ? "הכנסה" : "הוצאה"}</td>
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
                    <div className="flex gap-4">
                      <Link href="/category/%D7%94%D7%95%D7%A6%D7%90%D7%95%D7%AA" className="underline font-medium">
                        מעבר להוצאות
                      </Link>
                      <Link href="/category/%D7%94%D7%9B%D7%A0%D7%A1%D7%95%D7%AA" className="underline font-medium">
                        מעבר להכנסות
                      </Link>
                    </div>
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
