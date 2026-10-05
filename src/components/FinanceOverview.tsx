"use client";

import { useState } from "react";
import Link from "next/link";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Pencil, Check, X, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

export type FinanceDoc = {
  _id: string;
  title: string;
  subcategory?: string;
  amount?: number;
  platformName?: string;
  expectedReturn?: number;
  commissionFee?: number;
  targetAmount?: number;
  isLiability?: boolean;
  externalLink?: string;
  amountHistory?: { amount: number; at: string }[];
  uploadedAt: string;
};

const COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#22c55e", "#ef4444", "#64748b", "#14b8a6", "#f97316"];

type GroupBy = "record" | "type";

function lastUpdated(d: FinanceDoc): string {
  const h = d.amountHistory;
  return h && h.length ? h[h.length - 1].at : d.uploadedAt;
}

// שינוי מהעדכון הקודם (אם יש לפחות שני רישומים בהיסטוריה)
function changeSincePrev(d: FinanceDoc): number | null {
  const h = d.amountHistory;
  if (!h || h.length < 2) return null;
  return h[h.length - 1].amount - h[h.length - 2].amount;
}

export function FinanceOverview({ initialDocs, sub }: { initialDocs: FinanceDoc[]; sub?: string }) {
  const [docs, setDocs] = useState(initialDocs);
  const [groupBy, setGroupBy] = useState<GroupBy>("record");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const withAmount = docs.filter((d) => typeof d.amount === "number");
  const assets = withAmount.filter((d) => !d.isLiability);
  const liabilities = withAmount.filter((d) => d.isLiability);
  const assetsTotal = assets.reduce((s, d) => s + (d.amount as number), 0);
  const liabilitiesTotal = liabilities.reduce((s, d) => s + (d.amount as number), 0);
  const net = assetsTotal - liabilitiesTotal;
  const expectedYearly = assets.reduce(
    (s, d) => s + ((d.amount as number) * (d.expectedReturn ?? 0)) / 100,
    0
  );

  // הנתונים לעוגה: רק נכסים בסכום חיובי (התחייבויות מוצגות בנפרד בסיכום)
  const slices: { name: string; value: number }[] = [];
  if (groupBy === "record") {
    for (const d of assets) {
      if ((d.amount as number) > 0) slices.push({ name: d.title, value: d.amount as number });
    }
  } else {
    const map = new Map<string, number>();
    for (const d of assets) {
      if ((d.amount as number) <= 0) continue;
      const key = d.subcategory || "ללא סוג";
      map.set(key, (map.get(key) || 0) + (d.amount as number));
    }
    for (const [name, value] of map) slices.push({ name, value });
  }
  slices.sort((a, b) => b.value - a.value);
  const slicesTotal = slices.reduce((s, x) => s + x.value, 0);

  const visible = sub ? docs.filter((d) => d.subcategory === sub) : docs;

  function startEdit(d: FinanceDoc) {
    setEditingId(d._id);
    setEditValue(d.amount != null ? String(d.amount) : "");
    setError("");
  }

  async function saveEdit(d: FinanceDoc) {
    const trimmed = editValue.trim();
    const n = Number(trimmed);
    if (trimmed === "" || !Number.isFinite(n)) {
      setError("יש להזין סכום תקין");
      return;
    }
    setSavingId(d._id);
    setError("");
    try {
      const res = await fetch(`/api/documents/${d._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setDocs((prev) =>
        prev.map((x) =>
          x._id === d._id
            ? { ...x, amount: updated.amount, amountHistory: updated.amountHistory }
            : x
        )
      );
      setEditingId(null);
    } catch {
      setError("שמירת הסכום נכשלה");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 text-center">
        <p className="text-sm text-slate-500">סה&quot;כ (נטו)</p>
        <p className="text-3xl font-bold text-teal-800 mt-1">{formatCurrency(net)}</p>
        <div className="flex justify-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
          <span>נכסים: {formatCurrency(assetsTotal)}</span>
          {liabilitiesTotal > 0 && (
            <span className="text-red-600">התחייבויות: {formatCurrency(liabilitiesTotal)}</span>
          )}
          {expectedYearly !== 0 && <span>רווח צפוי בשנה: {formatCurrency(expectedYearly)}</span>}
        </div>
      </div>

      {slices.length > 0 && (
        <div className="card p-4">
          <div className="flex gap-2 justify-center mb-2">
            {(["record", "type"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`rounded-full px-3.5 py-1 text-sm font-medium border ${
                  groupBy === g
                    ? "bg-teal-700 text-white border-teal-700"
                    : "bg-white text-slate-600 border-slate-300"
                }`}
              >
                {g === "record" ? "לפי רשומה" : "לפי סוג"}
              </button>
            ))}
          </div>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {slices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {slices.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate flex-1">{s.name}</span>
                <span className="text-slate-400 text-xs">
                  {slicesTotal > 0 ? Math.round((s.value / slicesTotal) * 100) : 0}%
                </span>
                <span className="font-medium">{formatCurrency(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">אין עדיין רשומות פיננסים.</p>
        )}
        {visible.map((d) => {
          const change = changeSincePrev(d);
          const progress =
            d.targetAmount && d.targetAmount > 0 && typeof d.amount === "number"
              ? Math.min(100, Math.round((d.amount / d.targetAmount) * 100))
              : null;
          const isEditing = editingId === d._id;
          return (
            <div key={d._id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/documents/${d._id}`} className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.title}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {[d.platformName, d.subcategory].filter(Boolean).join(" · ") || "—"}
                    {d.isLiability && <span className="text-red-600"> · התחייבות</span>}
                  </p>
                </Link>
                {d.externalLink && (
                  <a
                    href={d.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-teal-700 shrink-0"
                    aria-label="קישור לפלטפורמה"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      className="input flex-1"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(d);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      disabled={savingId === d._id}
                      onClick={() => saveEdit(d)}
                      className="p-2 rounded-lg bg-teal-700 text-white"
                      aria-label="שמור סכום"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-2 rounded-lg bg-slate-100 text-slate-600"
                      aria-label="ביטול"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`text-xl font-bold ${d.isLiability ? "text-red-600" : ""}`}>
                      {d.isLiability && typeof d.amount === "number" ? "-" : ""}
                      {formatCurrency(d.amount)}
                    </span>
                    {change !== null && change !== 0 && (
                      <span
                        className={`flex items-center gap-0.5 text-xs font-medium ${
                          change > 0 === !d.isLiability ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {change > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {change > 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(change))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(d)}
                      className="mr-auto p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                      aria-label="עדכון סכום"
                      title="עדכון סכום"
                    >
                      <Pencil size={16} />
                    </button>
                  </>
                )}
              </div>

              {progress !== null && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-teal-600" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {progress}% מהיעד ({formatCurrency(d.targetAmount)})
                  </p>
                </div>
              )}

              <div className="flex gap-3 flex-wrap text-xs text-slate-500 mt-2">
                {d.expectedReturn != null && <span>רווח צפוי: {d.expectedReturn}%</span>}
                {d.commissionFee != null && <span>עמלה: {d.commissionFee}%</span>}
                <span>עודכן: {formatDate(lastUpdated(d))}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
