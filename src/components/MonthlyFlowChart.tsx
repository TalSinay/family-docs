"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatCurrency, HEBREW_MONTHS } from "@/lib/format";
import { ListSkeleton } from "./Skeleton";

type MonthRow = { month: string; income: number; expenses: number; balance: number };
type ReportData = { months: MonthRow[]; totals: { income: number; expenses: number; balance: number } };

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#dc2626";

type Mode = "both" | "income" | "expense";

function shortLabel(key: string) {
  const m = Number(key.split("-")[1]);
  return HEBREW_MONTHS[m - 1].slice(0, 3);
}

function monthName(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${HEBREW_MONTHS[m - 1]} ${y}`;
}

// גרף לפי חודש + סיכום לשנה נבחרת. mode: "both" (פיננסים: הכנסות מול הוצאות), "income" או "expense".
// הנתונים מ-/api/reports (כולל תחזית לתשלומים חודשיים קבועים); חודשים עתידיים מוצגים בגוון בהיר יותר.
export function MonthlyFlowChart({ mode }: { mode: Mode }) {
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setData(null);
      setError(false);
      try {
        const res = await fetch(`/api/reports?from=${year}-01&to=${year}-12`);
        if (!res.ok) throw new Error();
        const json: ReportData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, activeWorkspaceId]);

  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const valueOf = (m: MonthRow) => (mode === "income" ? m.income : mode === "expense" ? m.expenses : 0);
  const mainColor = mode === "income" ? INCOME_COLOR : EXPENSE_COLOR;

  const chartData = (data?.months ?? []).map((m) => ({
    key: m.month,
    label: shortLabel(m.month),
    income: m.income,
    expenses: m.expenses,
    future: m.month > nowKey,
  }));

  // סיכום
  let summary: { label: string; value: string; tone?: string }[] = [];
  if (data) {
    const active = data.months.filter((m) => (mode === "both" ? m.income > 0 || m.expenses > 0 : valueOf(m) > 0));
    if (mode === "both") {
      summary = [
        { label: "הכנסות", value: formatCurrency(data.totals.income), tone: "text-emerald-700" },
        { label: "הוצאות", value: formatCurrency(data.totals.expenses), tone: "text-red-700" },
        {
          label: "מאזן",
          value: formatCurrency(data.totals.balance),
          tone: data.totals.balance >= 0 ? "text-emerald-700" : "text-red-700",
        },
      ];
    } else {
      const total = mode === "income" ? data.totals.income : data.totals.expenses;
      const top = active.reduce<MonthRow | null>((best, m) => (!best || valueOf(m) > valueOf(best) ? m : best), null);
      summary = [
        { label: `סה״כ ${mode === "income" ? "הכנסות" : "הוצאות"} ${year}`, value: formatCurrency(total), tone: mode === "income" ? "text-emerald-700" : "text-red-700" },
        { label: "ממוצע לחודש פעיל", value: active.length ? formatCurrency(Math.round(total / active.length)) : "—" },
        { label: "החודש הגבוה ביותר", value: top ? `${monthName(top.month).split(" ")[0]} · ${formatCurrency(valueOf(top))}` : "—" },
      ];
    }
  }

  const title = mode === "both" ? "הכנסות מול הוצאות לפי חודש" : mode === "income" ? "הכנסות לפי חודש" : "הוצאות לפי חודש";

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{title}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(year - 1)} aria-label="שנה קודמת" className="p-1.5 rounded-full hover:bg-slate-100">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <button onClick={() => setYear(year + 1)} aria-label="שנה הבאה" className="p-1.5 rounded-full hover:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">לא הצלחנו לטעון את הנתונים.</p>}
      {!data && !error && <ListSkeleton rows={2} />}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {summary.map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 px-2.5 py-2">
                <p className="text-[11px] text-slate-500 leading-tight">{s.label}</p>
                <p className={`text-sm font-bold mt-0.5 leading-tight ${s.tone ?? ""}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {mode === "both" && (
            <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_COLOR }} /> הכנסות
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} /> הוצאות
              </span>
            </div>
          )}

          <div style={{ width: "100%", height: 220, direction: "ltr" }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value))}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload?.key ? monthName(payload[0].payload.key) : "")}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                {mode === "both" ? (
                  <>
                    <Bar dataKey="income" name="הכנסות" radius={[4, 4, 0, 0]} maxBarSize={14}>
                      {chartData.map((d) => (
                        <Cell key={d.key} fill={INCOME_COLOR} fillOpacity={d.future ? 0.45 : 1} />
                      ))}
                    </Bar>
                    <Bar dataKey="expenses" name="הוצאות" radius={[4, 4, 0, 0]} maxBarSize={14}>
                      {chartData.map((d) => (
                        <Cell key={d.key} fill={EXPENSE_COLOR} fillOpacity={d.future ? 0.45 : 1} />
                      ))}
                    </Bar>
                  </>
                ) : (
                  <Bar dataKey={mode === "income" ? "income" : "expenses"} name={mode === "income" ? "הכנסות" : "הוצאות"} radius={[4, 4, 0, 0]} maxBarSize={22}>
                    {chartData.map((d) => (
                      <Cell key={d.key} fill={mainColor} fillOpacity={d.future ? 0.45 : 1} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-400">חודשים עתידיים (גוון בהיר) כוללים תחזית לתשלומים חודשיים קבועים.</p>
        </>
      )}
    </div>
  );
}
