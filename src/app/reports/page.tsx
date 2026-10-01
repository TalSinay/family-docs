"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, TrendingDown, TrendingUp, Scale, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { formatCurrency, HEBREW_MONTHS } from "@/lib/format";

type MonthRow = { month: string; income: number; expenses: number; balance: number };
type ReportData = { months: MonthRow[]; totals: { income: number; expenses: number; balance: number } };

const INCOME_COLOR = "#059669"; // emerald-600 - זהה לצבע ההכנסות בשאר האפליקציה
const EXPENSE_COLOR = "#dc2626"; // red-600 - זהה לצבע ההוצאות בשאר האפליקציה

function shortMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${HEBREW_MONTHS[m - 1].slice(0, 3)}׳ ${String(y).slice(2)}`;
}

function monthInputValue(year: number, month0: number) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  // ה-workspace הפעיל, כדי שמעבר בין workspace-ים ירענן מיד את הדוח.
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"year" | "range">("year");

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- "השנה הנוכחית"/טווח ברירת מחדל נקבעים רק בדפדפן
    setYear(now.getFullYear());
    setRangeFrom(monthInputValue(now.getFullYear(), Math.max(0, now.getMonth() - 5)));
    setRangeTo(monthInputValue(now.getFullYear(), now.getMonth()));
    setMounted(true);
  }, []);

  const fetchReport = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בטעינת הדוח");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (mode === "year") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתוני השנה/workspace הנבחרים, לא לולאת render
      fetchReport(`${year}-01`, `${year}-12`);
    } else if (appliedRange) {
      fetchReport(appliedRange.from, appliedRange.to);
    }
    // activeWorkspaceId בתלויות בכוונה: מעבר workspace מרענן מיד, בלי ניווט מלא.
  }, [mounted, mode, year, appliedRange, fetchReport, activeWorkspaceId]);

  function applyRange() {
    if (!rangeFrom || !rangeTo) return;
    setAppliedRange({ from: rangeFrom, to: rangeTo });
  }

  if (!mounted) {
    return <div className="card p-8 text-center text-sm text-slate-400">טוען דוחות...</div>;
  }

  const chartData = data?.months.map((m) => ({ ...m, label: shortMonthLabel(m.month) })) || [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowRight size={16} /> חזרה לדשבורד
        </Link>
        <h1 className="text-xl font-bold">דוחות הכנסות והוצאות</h1>
        <p className="text-sm text-slate-500">סיכום שנתי או טווח חודשים מותאם אישית</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("year")}
          className={mode === "year" ? "btn-primary flex-1" : "btn-secondary flex-1"}
        >
          סיכום שנתי
        </button>
        <button
          onClick={() => setMode("range")}
          className={mode === "range" ? "btn-primary flex-1" : "btn-secondary flex-1"}
        >
          טווח מותאם אישית
        </button>
      </div>

      {mode === "year" ? (
        <div className="card p-4 flex items-center justify-between">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1.5 rounded-full hover:bg-slate-100"
            aria-label="שנה קודמת"
          >
            <ChevronRight size={20} />
          </button>
          <span className="font-semibold text-lg">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-1.5 rounded-full hover:bg-slate-100"
            aria-label="שנה הבאה"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      ) : (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מחודש</label>
              <input
                type="month"
                className="input"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">עד חודש</label>
              <input
                type="month"
                className="input"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
          </div>
          <button onClick={applyRange} className="btn-primary w-full">
            הצג סיכום
          </button>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

      {loading && <p className="text-sm text-slate-400 text-center py-8">טוען...</p>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium mb-1">
                <TrendingUp size={14} /> הכנסות
              </div>
              <p className="text-lg font-bold">{formatCurrency(data.totals.income)}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium mb-1">
                <TrendingDown size={14} /> הוצאות
              </div>
              <p className="text-lg font-bold">{formatCurrency(data.totals.expenses)}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-1">
                <Scale size={14} /> מאזן
              </div>
              <p
                className={`text-lg font-bold ${
                  data.totals.balance >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrency(data.totals.balance)}
              </p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-4 text-xs text-slate-500 mb-2 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_COLOR }} />
                  הכנסות
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} />
                  הוצאות
                </span>
              </div>
              <div style={{ width: "100%", height: 240, direction: "ltr" }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value))}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ display: "none" }} />
                    <Bar dataKey="income" name="הכנסות" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="expenses" name="הוצאות" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-400 border-b border-slate-100">
                  <th className="font-medium px-4 py-2">חודש</th>
                  <th className="font-medium px-4 py-2">הכנסות</th>
                  <th className="font-medium px-4 py-2">הוצאות</th>
                  <th className="font-medium px-4 py-2">מאזן</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-slate-600">{shortMonthLabel(m.month)}</td>
                    <td className="px-4 py-2 text-emerald-700">{formatCurrency(m.income)}</td>
                    <td className="px-4 py-2 text-red-700">{formatCurrency(m.expenses)}</td>
                    <td className={`px-4 py-2 font-medium ${m.balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatCurrency(m.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
