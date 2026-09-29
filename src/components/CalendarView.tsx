"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import clsx from "clsx";

import { HEBREW_MONTHS } from "@/lib/format";

type Holiday = { date: string; title: string };
type EventItem = { _id: string; title: string; date: string; notes?: string };
type TaskItem = { _id: string; title: string; dueDate?: string; isDone: boolean };
type DocDue = { _id: string; title: string; dueDate?: string; dueDateTitle?: string };

type CalItem = {
  key: string;
  kind: "holiday" | "event" | "task" | "document";
  title: string;
  id?: string;
  done?: boolean;
  notes?: string;
};

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

const KIND_DOT: Record<CalItem["kind"], string> = {
  holiday: "bg-amber-500",
  event: "bg-teal-600",
  task: "bg-violet-500",
  document: "bg-orange-500",
};

const KIND_ROW_STYLES: Record<CalItem["kind"], string> = {
  holiday: "bg-amber-50 text-amber-800",
  event: "bg-slate-50 text-slate-800",
  task: "bg-violet-50 text-violet-800",
  document: "bg-orange-50 text-orange-800",
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// תווית תאריך "ידנית" מ-"YYYY-MM-DD" (בלי new Date(str) שמפורש כ-UTC) כדי למנוע היסט יום
function formatDayHeader(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d)
  );
}

export function CalendarView() {
  // "מה היום" נקבע אך ורק בדפדפן (לא בשרת), כדי שלא יהיה פער בין אזור הזמן
  // של השרת לזה של המשתמש - וכדי שה-HTML הראשוני יהיה זהה בשרת ובלקוח.
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState(() => new Date(2026, 0, 1));
  const [todayStr, setTodayStr] = useState("");
  const [selectedDay, setSelectedDay] = useState("");

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [docDues, setDocDues] = useState<DocDue[]>([]);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");

  useEffect(() => {
    const now = new Date();
    const today = ymd(now);
    /* eslint-disable react-hooks/set-state-in-effect -- קביעת "מה היום" בכוונה רק
       אחרי עליית הרכיב בדפדפן, כדי שהתאריך יחושב לפי אזור הזמן של המשתמש ולא של השרת */
    setCursor(now);
    setTodayStr(today);
    setSelectedDay(today);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth(); // 0-based

  const days = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [year, month]);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch(
        `https://www.hebcal.com/hebcal?cfg=json&v=1&year=${year}&month=${month + 1}&maj=on&min=on&mod=on&s=on&c=off`
      );
      const data = await res.json();
      const items: Holiday[] = (data.items || [])
        .filter((i: { category?: string }) => i.category === "holiday")
        // חלק מהערכים מ-Hebcal מגיעים כ-"YYYY-MM-DDTHH:mm:ss+TZ" - לוקחים רק את תאריך הלוח,
        // לא ממירים ל-UTC (Date.parse), כדי שלא "יזוז" יום בגלל הפרש אזור זמן.
        .map((i: { date: string; title: string }) => ({ date: i.date.slice(0, 10), title: i.title }));
      setHolidays(items);
    } catch {
      setHolidays([]);
    }
  }, [year, month]);

  const fetchEvents = useCallback(async () => {
    const from = ymd(new Date(year, month, 1));
    const to = ymd(new Date(year, month + 1, 0));
    const res = await fetch(`/api/calendar-events?from=${from}&to=${to}`);
    if (res.ok) setEvents(await res.json());
  }, [year, month]);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const fetchDocDues = useCallback(async () => {
    const from = ymd(new Date(year, month, 1));
    const to = ymd(new Date(year, month + 1, 0));
    const res = await fetch(`/api/documents?dueFrom=${from}&dueTo=${to}&limit=200`);
    if (res.ok) setDocDues(await res.json());
  }, [year, month]);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים לפי חודש, לא לולאת render
    fetchHolidays();
    fetchEvents();
    fetchTasks();
    fetchDocDues();
  }, [mounted, fetchHolidays, fetchEvents, fetchTasks, fetchDocDues]);

  // כל הפריטים (חגים, אירועים, משימות עם תאריך יעד, מסמכים עם תאריך יעד) מקובצים לפי יום
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const push = (date: string, item: CalItem) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    };

    for (const h of holidays) push(h.date, { key: `h-${h.date}-${h.title}`, kind: "holiday", title: h.title });
    for (const e of events)
      push(e.date, { key: `e-${e._id}`, kind: "event", title: e.title, id: e._id, notes: e.notes });
    for (const t of tasks) {
      if (!t.dueDate) continue;
      push(t.dueDate, { key: `t-${t._id}`, kind: "task", title: t.title, id: t._id, done: t.isDone });
    }
    for (const d of docDues) {
      if (!d.dueDate) continue;
      push(d.dueDate, { key: `d-${d._id}`, kind: "document", title: d.dueDateTitle || d.title, id: d._id });
    }
    return map;
  }, [holidays, events, tasks, docDues]);

  function itemsForDay(dateStr: string): CalItem[] {
    return itemsByDay.get(dateStr) || [];
  }

  // כל התאריכים בחודש המוצג שיש בהם משהו, לפי סדר כרונולוגי - לרשימת "כל החודש" למטה,
  // שמוצגת תמיד ואינה תלויה בבחירת יום ספציפי
  const monthDatesWithItems = useMemo(() => {
    return days
      .filter((d): d is Date => !!d)
      .map((d) => ymd(d))
      .filter((dateStr) => itemsForDay(dateStr).length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, itemsByDay]);

  async function addEvent() {
    if (!newEventTitle.trim()) return;
    const res = await fetch("/api/calendar-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newEventTitle, date: selectedDay, notes: newEventNotes }),
    });
    if (res.ok) {
      setNewEventTitle("");
      setNewEventNotes("");
      fetchEvents();
    }
  }

  async function deleteEvent(id: string) {
    const res = await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
    if (res.ok) fetchEvents();
  }

  const selectedDayLabel = selectedDay ? formatDayHeader(selectedDay) : "";
  const selectedItems = itemsForDay(selectedDay);

  if (!mounted) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">טוען לוח שנה...</div>
    );
  }

  function renderItemRow(item: CalItem) {
    if (item.kind === "holiday") {
      return (
        <div key={item.key} className={clsx("rounded-xl px-3 py-2 text-sm", KIND_ROW_STYLES.holiday)} dir="auto">
          🕎 {item.title}
        </div>
      );
    }
    if (item.kind === "event") {
      return (
        <div
          key={item.key}
          className={clsx("flex items-start justify-between gap-2 rounded-xl px-3 py-2", KIND_ROW_STYLES.event)}
        >
          <div dir="auto">
            <p className="font-medium text-sm">{item.title}</p>
            {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
          </div>
          <button onClick={() => item.id && deleteEvent(item.id)} className="text-slate-400 hover:text-red-600 shrink-0">
            <Trash2 size={16} />
          </button>
        </div>
      );
    }
    if (item.kind === "task") {
      return (
        <Link
          key={item.key}
          href="/tasks"
          className={clsx("flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-violet-100 transition-colors", KIND_ROW_STYLES.task)}
          dir="auto"
        >
          <span className={clsx(item.done && "line-through opacity-60")}>✅ {item.title}</span>
        </Link>
      );
    }
    return (
      <Link
        key={item.key}
        href={`/documents/${item.id}`}
        className={clsx("flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-orange-100 transition-colors", KIND_ROW_STYLES.document)}
        dir="auto"
      >
        <span>📌 {item.title}</span>
        <ExternalLink size={14} className="shrink-0" />
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-full hover:bg-slate-100"
          >
            <ChevronRight size={20} />
          </button>
          <span className="font-semibold">
            {HEBREW_MONTHS[month]} {year}
          </span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-full hover:bg-slate-100"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-slate-400 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = ymd(d);
            const dayItems = itemsForDay(dateStr);
            // עד 4 נקודות, אחת לכל סוג נוכח באותו יום (לא אחת לכל פריט, כדי שלא יתפוצץ ביום עמוס)
            const kinds = Array.from(new Set(dayItems.map((it) => it.kind)));
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(dateStr)}
                className={clsx(
                  "aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors",
                  isSelected
                    ? "bg-teal-700 text-white"
                    : isToday
                      ? "bg-teal-50 text-teal-800 ring-1 ring-teal-300"
                      : "hover:bg-slate-100"
                )}
              >
                {d.getDate()}
                <div className="flex gap-0.5 mt-0.5">
                  {kinds.map((k) => (
                    <span
                      key={k}
                      className={clsx("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : KIND_DOT[k])}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* רשימת כל החודש - מוצגת תמיד, בלי צורך לבחור יום ספציפי */}
      <div className="card p-5">
        <h2 className="font-bold mb-3">מה קורה החודש</h2>
        <div className="space-y-4 max-h-[420px] overflow-y-auto">
          {monthDatesWithItems.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">אין אירועים או משימות החודש.</p>
          )}
          {monthDatesWithItems.map((dateStr) => (
            <div key={dateStr}>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs font-semibold text-slate-500">{formatDayHeader(dateStr)}</p>
                {dateStr === todayStr && (
                  <span className="text-[10px] text-teal-700 bg-teal-50 rounded-full px-2 py-0.5">היום</span>
                )}
              </div>
              <div className="space-y-1.5">{itemsForDay(dateStr).map(renderItemRow)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* הוספת אירוע ליום נבחר */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">
            {selectedDay === todayStr ? "הוסף אירוע להיום" : `הוסף אירוע ל-${selectedDayLabel}`}
          </h2>
          {selectedDay !== todayStr && (
            <button onClick={() => setSelectedDay(todayStr)} className="text-xs text-teal-700 font-medium">
              חזרה להיום
            </button>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="space-y-1.5 mb-3">{selectedItems.map(renderItemRow)}</div>
        )}

        <div className="space-y-2">
          <input
            className="input"
            placeholder="הוסף אירוע חדש ליום הנבחר..."
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEvent()}
          />
          {newEventTitle && (
            <>
              <input
                className="input"
                placeholder="הערות (אופציונלי)"
                value={newEventNotes}
                onChange={(e) => setNewEventNotes(e.target.value)}
              />
              <button onClick={addEvent} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={16} /> הוסף אירוע
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 text-xs text-slate-500 px-1 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> חג/מועד
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600" /> אירוע
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> משימה
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> תאריך יעד למסמך
        </span>
      </div>
    </div>
  );
}
