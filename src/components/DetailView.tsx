"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Upload, Trash2, Search, X } from "lucide-react";
import { HEBREW_MONTHS, formatCurrency } from "@/lib/format";
import { normalizeTitle } from "@/lib/recurring";
import { ListSkeleton } from "@/components/Skeleton";

type Entry = { id: string; title: string; amount: number; date: string };
type Batch = {
  id: string;
  fileName: string;
  importedAt: string;
  expenses: number;
  income: number;
  from: string;
  to: string;
};

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const LEDGER_PAGE = 60;
const TOP_MERCHANTS = 12;

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${HEBREW_MONTHS[mo - 1]} ${y}`;
}
function dmy(date: string) {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}
function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// עמוד "פירוט הוצאות" / "פירוט הכנסות": סקירת בתי עסק, מובילים בכל חודש, סיכומים ויומן תנועות.
// הנתונים מגיעים מאוסף נפרד (DetailEntry) ולא נספרים בהוצאות/הכנסות החודשיות.
export function DetailView({ kind }: { kind: "expenses" | "income" }) {
  const isExpense = kind === "expenses";
  const title = isExpense ? "פירוט הוצאות" : "פירוט הכנסות";
  const noun = isExpense ? "הוצאות" : "הכנסות";
  const tone = isExpense ? "text-red-700" : "text-emerald-700";
  const bar = isExpense ? "bg-red-400" : "bg-emerald-500";
  const categoryHref = `/category/${encodeURIComponent(noun)}`;

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(""); // "" = ברירת מחדל (החודש האחרון), "all" = כל התקופה
  const [merchant, setMerchant] = useState(""); // מפתח בית עסק לסינון היומן
  const [search, setSearch] = useState("");
  const [showAllMerchants, setShowAllMerchants] = useState(false);
  const [visible, setVisible] = useState(LEDGER_PAGE);
  const [reload, setReload] = useState(0);
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null); // סינון היומן ליום בשבוע (מהסיכום)
  const [highlightId, setHighlightId] = useState(""); // תנועה שמודגשת ביומן (למשל "התנועה הגדולה ביותר")

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/detail?kind=${kind}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/detail?batches=1").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([e, b]) => {
        if (cancelled) return;
        setEntries(e);
        setBatches(b);
      })
      .catch(() => {
        if (!cancelled) setError("טעינת הנתונים נכשלה");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, reload]);

  const scoped = useMemo(() => entries ?? [], [entries]);

  const monthTotals = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const e of scoped) {
      const k = e.date.slice(0, 7);
      const cur = m.get(k) || { total: 0, count: 0 };
      cur.total += e.amount;
      cur.count++;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ month: k, ...v }));
  }, [scoped]);

  const activeMonth = month || monthTotals[0]?.month || "all"; // ברירת מחדל: החודש האחרון שיש בו נתונים
  const inScope = useMemo(
    () => (activeMonth === "all" ? scoped : scoped.filter((e) => e.date.startsWith(activeMonth))),
    [scoped, activeMonth]
  );

  const stats = useMemo(() => {
    const total = inScope.reduce((t, e) => t + e.amount, 0);
    const count = inScope.length;
    let biggest: Entry | null = null;
    const weekdayTotals = new Array(7).fill(0) as number[];
    for (const e of inScope) {
      if (!biggest || e.amount > biggest.amount) biggest = e;
      weekdayTotals[weekday(e.date)] += e.amount;
    }
    const monthsWithData = new Set(inScope.map((e) => e.date.slice(0, 7))).size;
    const topWeekday = weekdayTotals.some((v) => v > 0) ? weekdayTotals.indexOf(Math.max(...weekdayTotals)) : -1;
    return { total, count, biggest, monthsWithData, topWeekday };
  }, [inScope]);

  const merchants = useMemo(() => {
    const m = new Map<string, { key: string; names: Map<string, number>; total: number; count: number; last: string }>();
    for (const e of inScope) {
      const key = normalizeTitle(e.title) || e.title.trim().toLowerCase();
      let g = m.get(key);
      if (!g) {
        g = { key, names: new Map(), total: 0, count: 0, last: e.date };
        m.set(key, g);
      }
      g.total += e.amount;
      g.count++;
      g.names.set(e.title.trim(), (g.names.get(e.title.trim()) || 0) + 1);
      if (e.date > g.last) g.last = e.date;
    }
    return [...m.values()]
      .map((g) => ({
        key: g.key,
        name: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
        total: g.total,
        count: g.count,
        last: g.last,
      }))
      .sort((a, b) => b.total - a.total);
  }, [inScope]);

  const prevTotal = useMemo(() => {
    if (activeMonth === "all") return null;
    const p = prevMonth(activeMonth);
    const found = monthTotals.find((m) => m.month === p);
    return found ? found.total : null;
  }, [activeMonth, monthTotals]);

  const ledger = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inScope
      .filter((e) => {
        if (merchant && (normalizeTitle(e.title) || e.title.trim().toLowerCase()) !== merchant) return false;
        if (q && !e.title.toLowerCase().includes(q)) return false;
        if (weekdayFilter !== null && weekday(e.date) !== weekdayFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
  }, [inScope, merchant, search, weekdayFilter]);

  const ledgerGroups = useMemo(() => {
    const groups: { date: string; items: Entry[]; total: number }[] = [];
    for (const e of ledger.slice(0, visible)) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) {
        last.items.push(e);
        last.total += e.amount;
      } else groups.push({ date: e.date, items: [e], total: e.amount });
    }
    return groups;
  }, [ledger, visible]);

  // מעבר מהסיכום ליומן התנועות, עם הסינון המתאים
  function showLedger(opts: { merchant?: string; weekday?: number | null; highlight?: string; clear?: boolean }) {
    setMerchant(opts.clear ? "" : opts.merchant ?? "");
    setWeekdayFilter(opts.weekday ?? null);
    setHighlightId(opts.highlight ?? "");
    setSearch("");
    setVisible(LEDGER_PAGE);
    setTimeout(() => document.getElementById("detail-ledger")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteBatch(b: Batch) {
    const name = b.fileName || "הקובץ הזה";
    if (!confirm(`למחוק את ${name} ? יימחקו כל התנועות שנוצרו ממנו בפירוט הוצאות והכנסות. אי אפשר לשחזר.`)) return;
    const res = await fetch(`/api/detail?batch=${encodeURIComponent(b.id)}`, { method: "DELETE" });
    if (!res.ok) {
      setError("מחיקת הקובץ נכשלה");
      return;
    }
    setError("");
    setEntries(null);
    setReload((n) => n + 1);
  }

  const maxMerchant = merchants[0]?.total || 1;
  const maxMonth = Math.max(1, ...monthTotals.map((m) => m.total));
  const shownMerchants = showAllMerchants ? merchants : merchants.slice(0, TOP_MERCHANTS);
  const importHref = "/import?mode=detail";
  const delta = prevTotal !== null && prevTotal > 0 ? ((stats.total - prevTotal) / prevTotal) * 100 : null;

  return (
    <div className="space-y-4">
      <Link href={categoryHref} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={16} /> חזרה ל{noun}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">מבוסס על קבצים שהעלית לפירוט בלבד - לא נספר ב{noun} החודשיות.</p>
        </div>
        <Link href={importHref} className="btn-primary flex items-center gap-1 shrink-0 text-sm">
          <Upload size={16} /> העלאת קובץ
        </Link>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}
      {!entries && !error && <ListSkeleton rows={4} />}

      {entries && entries.length === 0 && (
        <div className="card p-6 text-center space-y-3">
          <p className="font-medium">עוד לא הועלו קבצי פירוט</p>
          <p className="text-sm text-slate-500">העלה קובץ בנק או אשראי ונבנה כאן את הסקירה והיומן.</p>
          <Link href={importHref} className="btn-primary inline-flex items-center gap-1">
            <Upload size={16} /> העלאת קובץ
          </Link>
        </div>
      )}

      {entries && entries.length > 0 && (
        <>
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={activeMonth}
              onChange={(e) => {
                setMonth(e.target.value);
                setMerchant("");
                setVisible(LEDGER_PAGE);
              }}
            >
              <option value="all">כל התקופה</option>
              {monthTotals.map((m) => (
                <option key={m.month} value={m.month}>
                  {monthLabel(m.month)}
                </option>
              ))}
            </select>
          </div>

          <section className="card p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500">
                סה&quot;כ {noun} · {activeMonth === "all" ? "כל התקופה" : monthLabel(activeMonth)}
              </p>
              <p className={`text-3xl font-bold ${tone}`}>{formatCurrency(stats.total)}</p>
              {delta !== null && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {delta === 0
                    ? `ללא שינוי לעומת ${monthLabel(prevMonth(activeMonth))}`
                    : `${delta > 0 ? "עלייה" : "ירידה"} של ${Math.abs(Math.round(delta))}% לעומת ${monthLabel(prevMonth(activeMonth))} (${formatCurrency(prevTotal)})`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="מספר תנועות" value={String(stats.count)} onClick={() => showLedger({ clear: true })} />
              <Stat label="ממוצע לתנועה" value={formatCurrency(stats.count ? stats.total / stats.count : 0)} onClick={() => showLedger({ clear: true })} />
              <Stat label="בתי עסק שונים" value={String(merchants.length)} onClick={() => scrollTo("detail-merchants")} />
              {activeMonth === "all" ? (
                <Stat
                  label="ממוצע חודשי"
                  value={formatCurrency(stats.monthsWithData ? stats.total / stats.monthsWithData : 0)}
                  onClick={() => scrollTo("detail-months")}
                />
              ) : (
                <Stat label="ממוצע ליום" value={formatCurrency(stats.total / daysInMonth(activeMonth))} onClick={() => showLedger({ clear: true })} />
              )}
              {stats.biggest && (
                <Stat
                  label="התנועה הגדולה ביותר"
                  value={formatCurrency(stats.biggest.amount)}
                  sub={`${stats.biggest.title} · ${dmy(stats.biggest.date)}`}
                  onClick={() =>
                    showLedger({ merchant: normalizeTitle(stats.biggest!.title) || stats.biggest!.title.trim().toLowerCase(), highlight: stats.biggest!.id })
                  }
                />
              )}
              {merchants[0] && (
                <Stat label="בית העסק המוביל" value={merchants[0].name} sub={formatCurrency(merchants[0].total)} onClick={() => showLedger({ merchant: merchants[0].key })} />
              )}
              {stats.topWeekday >= 0 && (
                <Stat
                  label={`יום ${isExpense ? "ההוצאה" : "ההכנסה"} המרכזי`}
                  value={`יום ${WEEKDAYS[stats.topWeekday]}`}
                  onClick={() => showLedger({ weekday: stats.topWeekday })}
                />
              )}
              {(() => {
                const freq = [...merchants].sort((a, b) => b.count - a.count)[0];
                return freq ? (
                  <Stat label="הכי הרבה תנועות" value={freq.name} sub={`${freq.count} תנועות`} onClick={() => showLedger({ merchant: freq.key })} />
                ) : null;
              })()}
            </div>
          </section>

          {monthTotals.length > 1 && (
            <section id="detail-months" className="card p-4 space-y-2 scroll-mt-16">
              <h2 className="font-bold">סיכום לפי חודש</h2>
              {monthTotals.slice(0, 12).map((m) => (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => {
                    setMonth(m.month);
                    setMerchant("");
                    setWeekdayFilter(null);
                    setHighlightId("");
                    setVisible(LEDGER_PAGE);
                  }}
                  className={`w-full text-right rounded-lg px-2 py-1.5 ${m.month === activeMonth ? "bg-slate-100" : "hover:bg-slate-50"}`}
                >
                  <div className="flex justify-between text-sm">
                    <span>{monthLabel(m.month)}</span>
                    <span className={`font-medium ${tone}`}>{formatCurrency(m.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1">
                    <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${(m.total / maxMonth) * 100}%` }} />
                  </div>
                </button>
              ))}
            </section>
          )}

          <section id="detail-merchants" className="card p-4 space-y-2 scroll-mt-16">
            <h2 className="font-bold">
              בתי עסק · {activeMonth === "all" ? "כל התקופה" : monthLabel(activeMonth)} (מהגבוה לנמוך)
            </h2>
            {merchants.length === 0 && <p className="text-sm text-slate-400">אין תנועות בתקופה הזו.</p>}
            {shownMerchants.map((g, i) => (
              <button
                key={g.key}
                type="button"
                onClick={() => (merchant === g.key ? showLedger({ clear: true }) : showLedger({ merchant: g.key }))}
                className={`w-full text-right rounded-lg px-2 py-1.5 ${merchant === g.key ? "bg-teal-50 ring-1 ring-teal-300" : "hover:bg-slate-50"}`}
              >
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate">
                    <span className="text-slate-400 ml-1">{i + 1}.</span>
                    {g.name}
                  </span>
                  <span className={`font-medium shrink-0 ${tone}`}>{formatCurrency(g.total)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 rounded-full bg-slate-100 flex-1">
                    <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${(g.total / maxMerchant) * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {g.count} תנועות · {stats.total ? Math.round((g.total / stats.total) * 100) : 0}%
                  </span>
                </div>
              </button>
            ))}
            {merchants.length > TOP_MERCHANTS && (
              <button type="button" className="text-sm text-teal-700 font-medium" onClick={() => setShowAllMerchants((v) => !v)}>
                {showAllMerchants ? "הצג פחות" : `הצג את כל ${merchants.length} בתי העסק`}
              </button>
            )}
          </section>

          <section id="detail-ledger" className="card p-4 space-y-3 scroll-mt-16">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">יומן תנועות</h2>
              <span className="text-xs text-slate-400">{ledger.length} תנועות</span>
            </div>
            <div className="relative">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
              <input
                className="input pr-9"
                placeholder="חיפוש בית עסק"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisible(LEDGER_PAGE);
                }}
              />
            </div>
            {merchant && (
              <button
                type="button"
                onClick={() => setMerchant("")}
                className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 text-xs px-3 py-1"
              >
                {merchants.find((g) => g.key === merchant)?.name ?? "בית עסק"} <X size={12} />
              </button>
            )}
            {weekdayFilter !== null && (
              <button
                type="button"
                onClick={() => setWeekdayFilter(null)}
                className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 text-xs px-3 py-1 mr-2"
              >
                יום {WEEKDAYS[weekdayFilter]} <X size={12} />
              </button>
            )}
            {ledgerGroups.length === 0 && <p className="text-sm text-slate-400">אין תנועות להצגה.</p>}
            {ledgerGroups.map((g) => (
              <div key={g.date}>
                <div className="flex justify-between text-xs text-slate-500 border-b border-slate-100 pb-1 mb-1">
                  <span>
                    יום {WEEKDAYS[weekday(g.date)]} · {g.date.split("-").reverse().join(".")}
                  </span>
                  <span>{formatCurrency(g.total)}</span>
                </div>
                {g.items.map((e) => (
                  <div key={e.id} className={`flex items-center justify-between gap-3 py-1.5 text-sm ${e.id === highlightId ? "bg-amber-50 ring-1 ring-amber-300 rounded-lg px-2" : ""}`}>
                    <div className="min-w-0">
                      <p className="truncate">{e.title}</p>
                    </div>
                    <span className={`font-medium shrink-0 ${tone}`}>{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            {ledger.length > visible && (
              <button type="button" className="btn-secondary w-full" onClick={() => setVisible((v) => v + LEDGER_PAGE)}>
                הצג עוד ({ledger.length - visible})
              </button>
            )}
          </section>
        </>
      )}

      {batches.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="font-bold">קבצים שהועלו לפירוט</h2>
          <p className="text-xs text-slate-500">מחיקת קובץ מסירה את תנועותיו משני עמודי הפירוט (הוצאות והכנסות).</p>
          {batches.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{b.fileName || "ייבוא"}</p>
                <p className="text-xs text-slate-500">
                  יובא {new Date(b.importedAt).toLocaleDateString("he-IL")} · תנועות מ-{b.from.split("-").reverse().join(".")} עד {b.to.split("-").reverse().join(".")}
                </p>
                <p className="text-xs mt-0.5">
                  {b.expenses > 0 && <span className="text-red-700">הוצאות {b.expenses}</span>}
                  {b.expenses > 0 && b.income > 0 && " · "}
                  {b.income > 0 && <span className="text-emerald-700">הכנסות {b.income}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteBatch(b)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600"
                aria-label="מחיקת הקובץ"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function daysInMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo, 0).getDate();
}

function Stat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold truncate">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </>
  );
  if (!onClick) return <div className="rounded-xl bg-slate-50 px-3 py-2 min-w-0">{body}</div>;
  return (
    <button type="button" onClick={onClick} className="rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 px-3 py-2 min-w-0 text-right">
      {body}
    </button>
  );
}
