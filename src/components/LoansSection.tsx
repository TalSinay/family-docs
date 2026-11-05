"use client";

import { useState } from "react";
import { PieCard } from "./FinanceOverview";
import type { FinanceDoc, Slice } from "./FinanceOverview";
import { formatCurrency } from "@/lib/format";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMs(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function fmt(s: string) {
  const [y, m, d] = s.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

function monthsText(n: number) {
  if (n <= 0) return "החודש";
  if (n === 1) return "בעוד חודש";
  if (n < 12) return `בעוד ${n} חודשים`;
  const y = Math.floor(n / 12);
  const m = n % 12;
  return `בעוד ${y === 1 ? "שנה" : `${y} שנים`}${m ? ` ו-${m} חודשים` : ""}`;
}

// סיכום ההלוואות: סכומים, עוגה של היתרה לפי הלוואה, וציר זמן של מועדי הסיום.
// היתרה היא הערכה (סכום מקורי כפול התשלומים שנותרו, בלי ריבית) - ראו src/lib/loans.ts.
export function LoansSection({ loans }: { loans: FinanceDoc[] }) {
  const [today] = useState(() => ymd(new Date()));
  if (loans.length === 0) return null;

  const withEnd = loans.filter((l) => l.loanEndDate);
  const active = withEnd.filter((l) => (l.loanEndDate as string) > today).sort((a, b) => (a.loanEndDate as string).localeCompare(b.loanEndDate as string));
  const finished = withEnd.length - active.length;
  const noEnd = loans.filter((l) => !l.loanEndDate);

  const totalRemaining = loans.reduce((s, l) => s + (l.amount ?? 0), 0);
  const totalMonthly = active.reduce((s, l) => s + (l.loanMonthlyPayment ?? 0), 0);
  const slices: Slice[] = loans
    .filter((l) => (l.amount ?? 0) > 0)
    .map((l) => ({ name: l.title, value: l.amount as number }))
    .sort((a, b) => b.value - a.value);

  const lastEnd = active.length ? (active[active.length - 1].loanEndDate as string) : null;
  const span = lastEnd ? Math.max(1, toMs(lastEnd) - toMs(today)) : 1;

  // שנתונים על הציר (קו בכל 1 בינואר שבטווח)
  const ticks: { label: string; pct: number }[] = [];
  if (lastEnd) {
    const endYear = Number(lastEnd.slice(0, 4));
    for (let y = Number(today.slice(0, 4)) + 1; y <= endYear; y++) {
      const pct = ((toMs(`${y}-01-01`) - toMs(today)) / span) * 100;
      if (pct > 4 && pct < 96) ticks.push({ label: String(y), pct });
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-bold mb-3">הלוואות</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-red-50 px-2.5 py-2">
            <p className="text-[11px] text-red-700 leading-tight">יתרה משוערת</p>
            <p className="text-sm font-bold text-red-700 mt-0.5">{formatCurrency(totalRemaining)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2.5 py-2">
            <p className="text-[11px] text-slate-500 leading-tight">יורד בחודש</p>
            <p className="text-sm font-bold mt-0.5">{formatCurrency(totalMonthly)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2.5 py-2">
            <p className="text-[11px] text-slate-500 leading-tight">נגמרות כולן</p>
            <p className="text-sm font-bold mt-0.5">{lastEnd ? fmt(lastEnd) : "—"}</p>
          </div>
        </div>
        {noEnd.length > 0 && (
          <p className="text-xs text-amber-700 mt-2">ללא תאריך סיום (לא מופיעות בציר): {noEnd.map((l) => l.title).join(", ")}. אפשר להשלים בעמוד ההלוואה.</p>
        )}
        {finished > 0 && <p className="text-xs text-slate-400 mt-2">{finished} הלוואות כבר הסתיימו.</p>}
      </div>

      {slices.length > 0 && (
        <PieCard
          slices={slices}
          header={<p className="text-center text-sm font-medium text-slate-600 mb-2">יתרת הלוואות · {formatCurrency(totalRemaining)}</p>}
        />
      )}

      {active.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold mb-1">ציר זמן: מתי כל הלוואה נגמרת</h3>
          <p className="text-xs text-slate-400 mb-3">מהיום (מימין) ועד תאריך הסיום של כל הלוואה.</p>
          <div className="relative" dir="rtl">
            {ticks.map((t) => (
              <div key={t.label} className="absolute top-0 bottom-5 border-r border-dashed border-slate-200" style={{ right: `${t.pct}%` }}>
                <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] text-slate-400">{t.label}</span>
              </div>
            ))}
            <div className="space-y-3 pb-6">
              {active.map((l, i) => {
                const end = l.loanEndDate as string;
                const pct = Math.max(6, ((toMs(end) - toMs(today)) / span) * 100);
                const color = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#22c55e", "#ef4444", "#14b8a6"][i % 8];
                return (
                  <div key={l._id}>
                    <div className="h-7 rounded-md relative" style={{ width: `${pct}%`, backgroundColor: color }}>
                      <span className="absolute inset-y-0 right-2 flex items-center text-xs text-white font-medium truncate max-w-full pl-2">{l.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      נגמרת ב-{fmt(end)} · {monthsText(l.loanMonthsLeft ?? 0)}
                      {l.loanMonthlyPayment != null && ` · ${formatCurrency(l.loanMonthlyPayment)} לחודש`}
                      {l.loanInterestRate != null && ` · ריבית ${l.loanInterestRate}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// טופס הוספת הלוואה: נשמרת כרשומת פיננסים (תת-קטגוריה "הלוואה", התחייבות)
export function LoanForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [lender, setLender] = useState("");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [monthly, setMonthly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!title.trim() || !amount || !start || !end || !monthly) {
      setError("יש למלא שם, סכום, תאריכים וסכום חודשי");
      return;
    }
    if (end < start) {
      setError("תאריך הסיום חייב להיות אחרי תאריך הירידה הראשונה");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: "פיננסים",
          subcategory: "הלוואה",
          amount: Number(amount),
          platformName: lender.trim(),
          isLiability: true,
          loanStartDate: start,
          loanEndDate: end,
          loanMonthlyPayment: Number(monthly),
        }),
      });
      if (!res.ok) throw new Error();
      onDone();
    } catch {
      setError("שמירת ההלוואה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">שם ההלוואה *</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: הלוואה לרכב" />
      </div>
      <div>
        <label className="label">גוף מלווה (אופציונלי)</label>
        <input className="input" value={lender} onChange={(e) => setLender(e.target.value)} placeholder="לדוגמה: בנק לאומי" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">סכום ההלוואה (₪) *</label>
          <input type="number" inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">יורד כל חודש (₪) *</label>
          <input type="number" inputMode="decimal" className="input" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </div>
        <div>
          <label className="label">תאריך ירידה ראשונה *</label>
          <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">תאריך סיום *</label>
          <input type="date" className="input" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="btn-primary w-full disabled:opacity-60">
        {busy ? "שומר..." : "שמירת הלוואה"}
      </button>
    </div>
  );
}
