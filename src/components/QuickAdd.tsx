"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Search, Send, Sparkles } from "lucide-react";
import { Modal } from "./Modal";
import { parse } from "@/lib/quickAdd/parse";
import { suggest, loadHistory, rememberInput } from "@/lib/quickAdd/suggest";
import type { Highlight, HighlightKind, Intent, ParseResult } from "@/lib/quickAdd/types";

// ---------- עזרים ----------

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

const HL: Record<HighlightKind, string> = {
  int: "bg-teal-100 text-teal-800",
  amt: "bg-emerald-100 text-emerald-800",
  cat: "bg-amber-100 text-amber-800",
  date: "bg-blue-100 text-blue-800",
  rec: "bg-violet-100 text-violet-800",
};
const HL_LABEL: Record<HighlightKind, string> = {
  int: "כוונה",
  amt: "סכום",
  cat: "קטגוריה",
  date: "תאריך",
  rec: "חזרתיות",
};

function Highlighted({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  [...highlights]
    .sort((a, b) => a.start - b.start)
    .forEach((h, i) => {
      if (h.start > pos) parts.push(text.slice(pos, h.start));
      parts.push(
        <span key={i} className={`${HL[h.kind]} rounded-md px-1.5 py-0.5 font-bold`}>
          {text.slice(h.start, h.end)}
        </span>
      );
      pos = h.end;
    });
  if (pos < text.length) parts.push(text.slice(pos));
  const used = Array.from(new Set(highlights.map((h) => h.kind)));
  return (
    <div>
      <div className="card p-3.5 text-base leading-9">{parts}</div>
      {used.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
          {used.map((k) => (
            <span key={k} className={`${HL[k]} rounded-md px-2 py-0.5 font-bold`}>
              {HL_LABEL[k]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  expense: "זיהיתי הוצאה",
  income: "זיהיתי הכנסה",
  task: "זיהיתי משימה",
  monthly: "זיהיתי תזכורת חודשית",
  shopping: "זיהיתי פריטי קניות",
  question: "זיהיתי שאלה",
};

// ---------- שורת הכתיבה + הצעות ----------

export function QuickAddInput() {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<{ text: string; result: ParseResult; today: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת היסטוריה מהמכשיר אחרי עליית הרכיב
    setHistory(loadHistory());
  }, []);

  const suggestions = useMemo(() => suggest(text, history), [text, history]);

  function pick(s: string) {
    setText(s);
    const idx = s.indexOf("___");
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (idx >= 0) el.setSelectionRange(idx, idx + 3);
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const today = localToday();
    setSubmitted({ text: t, result: parse(t, today), today });
    setFocused(false);
    inputRef.current?.blur();
  }

  function close(clear: boolean) {
    setSubmitted(null);
    if (clear) setText("");
  }

  return (
    <>
      {focused && suggestions.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 max-w-3xl mx-auto card overflow-hidden">
          <p className="text-[11px] font-bold text-slate-500 px-4 pt-2.5 pb-1">הצעות</p>
          {suggestions.map((s) => (
            <button
              key={s.id + s.text}
              type="button"
              // mousedown (ולא click) כדי שהשדה לא יאבד פוקוס לפני הבחירה
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s.text);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-start border-t border-slate-100 hover:bg-slate-50"
            >
              <Sparkles size={15} className="text-teal-700 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{s.text}</span>
                {s.hint && <span className="block text-xs text-slate-500">{s.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex-1 min-w-0">
        <label className="flex items-center gap-2 h-12 rounded-full border border-slate-300 bg-white ps-4 pe-1.5 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="שאל, הוסף או חפש..."
            enterKeyHint="send"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-slate-400"
          />
          {text.trim() && (
            <button
              type="submit"
              aria-label="שלח"
              className="w-9 h-9 shrink-0 rounded-full bg-teal-700 text-white flex items-center justify-center"
            >
              <Send size={15} className="-scale-x-100" />
            </button>
          )}
        </label>
      </form>

      {submitted && (
        <QuickAddResult
          key={submitted.text}
          text={submitted.text}
          initial={submitted.result}
          today={submitted.today}
          onClose={close}
        />
      )}
    </>
  );
}

// ---------- כרטיס האישור ----------

type Phase = "edit" | "saving" | "done" | "error";

function QuickAddResult({
  text,
  initial,
  today,
  onClose,
}: {
  text: string;
  initial: ParseResult;
  today: string;
  onClose: (clearInput: boolean) => void;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ParseResult>(initial);
  const [title, setTitle] = useState(initial.title);
  const [amount, setAmount] = useState(initial.amount !== undefined ? String(initial.amount) : "");
  const [date, setDate] = useState(initial.date ?? today);
  const [time, setTime] = useState(initial.time ?? "");
  const [day, setDay] = useState(initial.dayOfMonth !== undefined ? String(initial.dayOfMonth) : "1");
  const [sub, setSub] = useState(initial.subcategory ?? "");
  const [itemsText, setItemsText] = useState((initial.items ?? []).join(", "));
  const [phase, setPhase] = useState<Phase>("edit");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState<{ href: string; label: string } | null>(null);

  function reparse(intent: Intent) {
    const r = parse(text, today, undefined, intent);
    setResult(r);
    setTitle(r.title);
    setAmount(r.amount !== undefined ? String(r.amount) : "");
    setDate(r.date ?? today);
    setTime(r.time ?? "");
    setDay(r.dayOfMonth !== undefined ? String(r.dayOfMonth) : "1");
    setSub(r.subcategory ?? "");
    setItemsText((r.items ?? []).join(", "));
  }

  const amountNum = Number(amount);
  const dayNum = Number(day);
  const items = itemsText.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);

  const valid =
    result.kind === "expense" || result.kind === "income"
      ? !!title.trim() && Number.isFinite(amountNum) && amountNum > 0
      : result.kind === "task"
        ? !!title.trim() && !!date
        : result.kind === "monthly"
          ? !!title.trim() && Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 28
          : result.kind === "shopping"
            ? items.length > 0
            : false;

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "השמירה נכשלה");
    return data;
  }

  async function save() {
    setPhase("saving");
    try {
      if (result.kind === "expense" || result.kind === "income") {
        const category = result.kind === "expense" ? "הוצאות" : "הכנסות";
        await call("/api/documents", "POST", {
          title: title.trim(),
          category,
          subcategory: sub.trim() || undefined,
          amount: amountNum,
          // שעה 12:00 כדי שהתאריך לא יזוז בין אזורי זמן
          uploadedAt: new Date(`${date}T12:00:00`).toISOString(),
        });
        setMessage(`${result.kind === "expense" ? "ההוצאה" : "ההכנסה"} נשמרה`);
        setLink({ href: `/category/${encodeURIComponent(category)}`, label: `פתח ${category}` });
      } else if (result.kind === "task") {
        const task = await call("/api/tasks", "POST", { title: title.trim(), dueDate: date });
        if (time) await call(`/api/tasks/${task._id}`, "PATCH", { notifyTime: time });
        setMessage("המשימה נוצרה");
        setLink({ href: "/tasks", label: "פתח משימות" });
      } else if (result.kind === "monthly") {
        await call("/api/monthly-reminders", "POST", { title: title.trim(), dayOfMonth: dayNum, time: time || undefined });
        setMessage("התזכורת החודשית נוצרה");
        setLink({ href: "/notifications", label: "פתח התראות" });
      } else if (result.kind === "shopping") {
        const lists = await fetch("/api/shopping-lists").then((r) => r.json());
        const open = Array.isArray(lists) ? lists.find((l: { isCompleted: boolean }) => !l.isCompleted) : null;
        const list = open ?? (await call("/api/shopping-lists", "POST", {}));
        const existing = (open?.items ?? []) as { name: string; quantity?: number; inCart?: boolean; imageFileId?: string }[];
        await call(`/api/shopping-lists/${list._id}`, "PATCH", {
          items: [...existing, ...items.map((name) => ({ name, quantity: 1, inCart: false }))],
        });
        setMessage(`נוספו ${items.length} פריטים לקניות`);
        setLink({ href: `/shopping/${list._id}`, label: "פתח רשימת קניות" });
      }
      rememberInput(text);
      setPhase("done");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "השמירה נכשלה");
      setPhase("error");
    }
  }

  const title0 = result.kind === "unknown" ? "לא בטוח מה התכוונת" : KIND_LABEL[result.kind];

  return (
    <Modal open onClose={() => onClose(phase === "done")} title={title0}>
      <div className="space-y-4">
        <Highlighted text={text} highlights={result.highlights} />

        {result.kind === "question" && <QuestionAnswer result={result} today={today} onClose={() => onClose(false)} />}

        {result.kind === "unknown" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">אולי התכוונת ל...</p>
            {(
              [
                ["expense", "הוצאה"],
                ["income", "הכנסה"],
                ["task", "משימה / תזכורת"],
                ["shopping", "פריטים לקניות"],
              ] as [Intent, string][]
            ).map(([intent, label]) => (
              <button key={intent} onClick={() => reparse(intent)} className="card w-full p-3 text-start text-sm font-medium hover:border-teal-300">
                {label}
              </button>
            ))}
            <Link
              href={`/search?q=${encodeURIComponent(text)}`}
              onClick={() => onClose(true)}
              className="card w-full p-3 text-start text-sm font-medium hover:border-teal-300 flex items-center gap-2"
            >
              <Search size={15} /> חפש: {text}
            </Link>
          </div>
        )}

        {(result.kind === "expense" || result.kind === "income") && phase !== "done" && (
          <div className="space-y-3">
            <div>
              <label className="label">שם</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">סכום (₪)</label>
                <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">תאריך</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">תת-קטגוריה (אופציונלי)</label>
              <input className="input" value={sub} onChange={(e) => setSub(e.target.value)} />
            </div>
          </div>
        )}

        {result.kind === "task" && phase !== "done" && (
          <div className="space-y-3">
            <div>
              <label className="label">מה לעשות</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">תאריך יעד</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">שעת התראה</label>
                <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {result.kind === "monthly" && phase !== "done" && (
          <div className="space-y-3">
            <div>
              <label className="label">מה להזכיר</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">יום בחודש (1-28)</label>
                <input className="input" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
              </div>
              <div>
                <label className="label">שעה (ברירת מחדל: הכללית)</label>
                <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {result.kind === "shopping" && phase !== "done" && (
          <div>
            <label className="label">פריטים (מופרדים בפסיק)</label>
            <input className="input" value={itemsText} onChange={(e) => setItemsText(e.target.value)} />
          </div>
        )}

        {result.notes.length > 0 && phase === "edit" && result.kind !== "unknown" && (
          <p className="text-xs text-slate-500">{result.notes.join(" · ")}</p>
        )}
        {result.confidence === "medium" && phase === "edit" && result.kind !== "unknown" && result.kind !== "question" && (
          <p className="text-xs text-amber-700">לא הייתי בטוח לגמרי, כדאי לבדוק את השדות לפני שמירה.</p>
        )}

        {phase === "error" && <p className="text-sm text-red-600">{message}</p>}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="card p-3.5 flex items-center gap-2.5 bg-emerald-50 border-emerald-200 text-emerald-800">
              <Check size={18} /> <span className="font-medium text-sm">{message}</span>
            </div>
            <div className="flex gap-2">
              {link && (
                <Link href={link.href} onClick={() => onClose(true)} className="btn-primary flex-1 text-center">
                  {link.label}
                </Link>
              )}
              <button onClick={() => onClose(true)} className="btn-secondary flex-1">
                סגור
              </button>
            </div>
          </div>
        )}

        {(phase === "edit" || phase === "saving" || phase === "error") &&
          result.kind !== "unknown" &&
          result.kind !== "question" && (
            <div className="flex gap-2">
              <button onClick={save} disabled={!valid || phase === "saving"} className="btn-primary flex-1">
                {phase === "saving" ? "שומר..." : "שמור"}
              </button>
              <button onClick={() => onClose(false)} className="btn-secondary flex-1">
                ביטול
              </button>
            </div>
          )}
      </div>
    </Modal>
  );
}

// ---------- תשובה לשאלה: חיפוש לפי מילות מפתח ותבנית תשובה ----------

type FoundDoc = { _id: string; title: string; category: string; amount?: number; dueDate?: string };

function QuestionAnswer({ result, today, onClose }: { result: ParseResult; today: string; onClose: () => void }) {
  const [docs, setDocs] = useState<FoundDoc[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const words = (result.searchQuery ?? "").split(/\s+/).filter((w) => w.length >= 2).slice(0, 4);
      if (!words.length) {
        if (!cancelled) setDocs([]);
        return;
      }
      const lists = await Promise.all(
        words.map((w) =>
          fetch(`/api/search?q=${encodeURIComponent(w)}`)
            .then((r) => (r.ok ? r.json() : { documents: [] }))
            .then((j) => (j.documents ?? []) as FoundDoc[])
            .catch(() => [] as FoundDoc[])
        )
      );
      // מדרגים לפי כמה מילות מפתח תאמו כל מסמך
      const hits = new Map<string, { doc: FoundDoc; n: number }>();
      lists.flat().forEach((d) => {
        const cur = hits.get(d._id);
        if (cur) cur.n += 1;
        else hits.set(d._id, { doc: d, n: 1 });
      });
      const ranked = [...hits.values()].sort((a, b) => b.n - a.n).map((x) => x.doc).slice(0, 5);
      if (!cancelled) setDocs(ranked);
    })();
    return () => {
      cancelled = true;
    };
  }, [result.searchQuery]);

  if (docs === null) return <p className="text-sm text-slate-500 text-center py-4">מחפש...</p>;

  const top = docs[0];
  let answer = "";
  if (top) {
    if (result.questionType === "when" && top.dueDate) {
      const diff = dayDiff(today, top.dueDate);
      const [y, m, d] = top.dueDate.split("-").map(Number);
      answer = `${top.title}: תאריך יעד ב-${d}.${m}.${y}${diff >= 0 ? ` (בעוד ${diff} ימים)` : ` (לפני ${-diff} ימים)`}`;
    } else if (result.questionType === "howMuch") {
      const withAmount = docs.filter((x) => typeof x.amount === "number");
      if (withAmount.length) {
        const total = withAmount.reduce((s, x) => s + (x.amount ?? 0), 0);
        answer = `נמצאו ${withAmount.length} רשומות עם סכום, בסך ${total.toLocaleString("he-IL")} ₪`;
      }
    }
  }

  return (
    <div className="space-y-3">
      {answer && <div className="card p-3.5 bg-teal-50 border-teal-200 text-sm font-medium leading-relaxed">{answer}</div>}
      {docs.length === 0 ? (
        <p className="text-sm text-slate-500">לא נמצאו מסמכים תואמים.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500">נמצאו</p>
          {docs.map((d) => (
            <Link
              key={d._id}
              href={`/documents/${d._id}`}
              onClick={onClose}
              className="card p-3 flex items-center justify-between gap-2 hover:border-teal-300"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{d.title}</span>
                <span className="block text-xs text-slate-500">{d.category}</span>
              </span>
              {typeof d.amount === "number" && <span className="text-sm font-medium shrink-0">₪{d.amount.toLocaleString("he-IL")}</span>}
            </Link>
          ))}
        </div>
      )}
      <Link
        href={`/search?q=${encodeURIComponent(result.searchQuery || result.title)}`}
        onClick={onClose}
        className="btn-secondary block text-center text-sm"
      >
        כל תוצאות החיפוש
      </Link>
    </div>
  );
}
