"use client";

import { useCallback, useEffect, useState } from "react";
import { Repeat, Landmark } from "lucide-react";
import { Modal } from "./Modal";
import { useToast } from "./ToastProvider";
import { formatCurrency } from "@/lib/format";
import { addMonthsStr, countPayments } from "@/lib/loans";

type Candidate = {
  key: string;
  title: string;
  amount: number;
  months: number;
  firstDate: string;
  lastDate: string;
  likelyLoan: boolean;
};

function fmt(s: string) {
  const [y, m, d] = s.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

// כלי בעמוד ההוצאות: מזהה הוצאות קבועות (אותו שם וסכום בכל חודש) ושואל אם זו הלוואה.
// אם כן - שואל את הפרטים החסרים (סיום, ריבית, סכום מקורי) ומוסיף לפיננסים/גרף ההלוואות לצורך מודעות בלבד;
// לא נוצרת הוצאה חודשית נוספת.
export function RecurringExpenses() {
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [active, setActive] = useState<Candidate | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/recurring-expenses");
      if (res.ok) setItems(await res.json());
      else setItems([]);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים בעליית העמוד
    load();
  }, [load]);

  async function dismiss(c: Candidate) {
    setItems((prev) => (prev ? prev.filter((x) => x.key !== c.key) : prev));
    await fetch("/api/recurring-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: c.key }),
    });
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Repeat size={18} className="text-teal-700" />
        <h2 className="font-bold">הוצאות קבועות שזוהו</h2>
      </div>
      <p className="text-xs text-slate-500">
        הוצאות שחוזרות באותו סכום כל חודש. אם זו הלוואה, אפשר להוסיף אותה לגרף ההלוואות כדי לדעת מתי היא נגמרת (לא תיווצר הוצאה נוספת).
      </p>
      {items.map((c) => (
        <div key={c.key} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{c.title}</p>
              <p className="text-xs text-slate-500">
                {formatCurrency(c.amount)} לחודש · נראתה {c.months} חודשים · מאז {fmt(c.firstDate)}
              </p>
            </div>
            {c.likelyLoan && <span className="rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium px-2 py-0.5 shrink-0">נראה כמו הלוואה</span>}
          </div>
          <p className="text-sm mt-2">האם זו הלוואה?</p>
          <div className="flex gap-2 mt-1.5">
            <button type="button" onClick={() => setActive(c)} className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5">
              <Landmark size={14} /> כן, הלוואה
            </button>
            <button type="button" onClick={() => dismiss(c)} className="btn-secondary text-sm px-4 py-1.5">
              לא
            </button>
          </div>
        </div>
      ))}

      <Modal open={!!active} onClose={() => setActive(null)} title="פרטי ההלוואה">
        {active && (
          <LoanWizard
            key={active.key}
            c={active}
            onDone={(title) => {
              setActive(null);
              setItems((prev) => (prev ? prev.filter((x) => x.key !== active.key) : prev));
              toast.show({ title: "ההלוואה נוספה", detail: title, href: "/category/%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99%D7%9D", hrefLabel: "פתח פיננסים" });
            }}
          />
        )}
      </Modal>
    </div>
  );
}

type EndMode = "date" | "left" | "unknown";

function LoanWizard({ c, onDone }: { c: Candidate; onDone: (title: string) => void }) {
  const [title, setTitle] = useState(c.title);
  const [lender, setLender] = useState("");
  const [start, setStart] = useState(c.firstDate);
  const [mode, setMode] = useState<EndMode>("date");
  const [endDate, setEndDate] = useState("");
  const [left, setLeft] = useState("");
  const [original, setOriginal] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const end =
    mode === "date" ? endDate : mode === "left" && Number(left) > 0 ? addMonthsStr(c.lastDate, Number(left)) : "";
  const total = start && end ? countPayments(start, end) : null;
  const estimated = !original && total ? Math.round(c.amount * total) : null;

  async function save() {
    setError("");
    if (!title.trim()) return setError("יש להזין שם");
    if (end && end < start) return setError("תאריך הסיום חייב להיות אחרי תחילת ההלוואה");
    setBusy(true);
    try {
      const amount = original ? Number(original) : estimated ?? undefined;
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: "פיננסים",
          subcategory: "הלוואה",
          amount,
          platformName: lender.trim(),
          isLiability: true,
          loanStartDate: start,
          loanEndDate: end || null,
          loanMonthlyPayment: c.amount,
          loanInterestRate: rate ? Number(rate) : null,
          loanSourceKey: c.key,
          notes: "נוספה מזיהוי הוצאה קבועה (לצורך מעקב בלבד; לא נוצרת הוצאה חודשית)",
        }),
      });
      if (!res.ok) throw new Error();
      onDone(title.trim());
    } catch {
      setError("שמירת ההלוואה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        זיהינו {formatCurrency(c.amount)} לחודש. כדי לראות את התמונה המלאה נשאל כמה דברים (אפשר לדלג על מה שלא ידוע).
      </p>
      <div>
        <label className="label">שם ההלוואה</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label">מי נתן את ההלוואה? (בנק / גוף מלווה)</label>
        <input className="input" value={lender} onChange={(e) => setLender(e.target.value)} placeholder="לדוגמה: בנק לאומי" />
      </div>
      <div>
        <label className="label">מתי ירדה ההלוואה לראשונה?</label>
        <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        <p className="text-xs text-slate-400 mt-1">מילאנו את התאריך הראשון שנמצא אצלנו; אם ההלוואה התחילה קודם, תקן.</p>
      </div>

      <div>
        <p className="label">מתי ההלוואה מסתיימת?</p>
        <div className="flex gap-2 flex-wrap mb-2">
          {([
            ["date", "יודע תאריך סיום"],
            ["left", "יודע כמה תשלומים נשארו"],
            ["unknown", "לא יודע"],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-sm border ${mode === m ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "date" && <input type="date" className="input" min={start} value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
        {mode === "left" && (
          <input type="number" inputMode="numeric" className="input" placeholder="כמה תשלומים נשארו (כולל החודש הבא)" value={left} onChange={(e) => setLeft(e.target.value)} />
        )}
        {mode === "unknown" && <p className="text-xs text-amber-700">בלי תאריך סיום ההלוואה לא תופיע בציר הזמן. אפשר להשלים מאוחר יותר בעמוד ההלוואה.</p>}
        {end && <p className="text-xs text-slate-500 mt-1">תאריך סיום: {fmt(end)}{total ? ` · ${total} תשלומים בסך הכל` : ""}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">סכום ההלוואה המקורי (₪)</label>
          <input type="number" inputMode="decimal" className="input" value={original} onChange={(e) => setOriginal(e.target.value)} />
          {estimated && <p className="text-xs text-slate-400 mt-1">אם ריק: הערכה {formatCurrency(estimated)}</p>}
        </div>
        <div>
          <label className="label">ריבית שנתית (%)</label>
          <input type="number" inputMode="decimal" step="0.01" className="input" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-slate-500">ההלוואה תתווסף לפיננסים ולגרף ההלוואות, לצורך מודעות בלבד. לא תיווצר הוצאה חודשית נוספת.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="btn-primary w-full disabled:opacity-60">
        {busy ? "שומר..." : "הוספה להלוואות"}
      </button>
    </div>
  );
}
