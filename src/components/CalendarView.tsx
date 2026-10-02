"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, Trash2, ExternalLink, Pencil, Check, X } from "lucide-react";
import clsx from "clsx";

import { HEBREW_MONTHS } from "@/lib/format";
import { DEFAULT_EVENT_COLOR, DEFAULT_TASK_COLOR } from "@/lib/itemColors";
import { ColorPicker } from "./ColorPicker";

type Holiday = { date: string; title: string };
type EventItem = { _id: string; title: string; date: string; notes?: string; color?: string };
type TaskItem = { _id: string; title: string; dueDate?: string; isDone: boolean; color?: string };
type DocDue = { _id: string; title: string; dueDate?: string; dueDateTitle?: string };

type CalItem = {
  key: string;
  kind: "holiday" | "event" | "task" | "document";
  title: string;
  id?: string;
  done?: boolean;
  notes?: string;
  color?: string;
};

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

// צבע ברירת המחדל לכל סוג (כשלא נבחר צבע מותאם) - חגים ומסמכים לא ניתנים
// להתאמה אישית, רק אירועים ומשימות (ראו src/lib/itemColors.ts).
const DEFAULT_KIND_COLOR: Record<CalItem["kind"], string> = {
  holiday: "#f59e0b", // amber-500
  event: DEFAULT_EVENT_COLOR,
  task: DEFAULT_TASK_COLOR,
  document: "#f97316", // orange-500
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
  // ה-workspace הפעיל, כדי שמעבר בין workspace-ים (WorkspaceSwitcher) ירענן
  // מיד את הנתונים המוצגים כאן ולא ישאיר מידע "תקוע" מה-workspace הקודם.
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;

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
  const [newEventColor, setNewEventColor] = useState(DEFAULT_EVENT_COLOR);

  // עריכת אירוע קיים (נפתח inline בתוך הרשימה, ראו renderItemRow)
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_EVENT_COLOR);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים לפי חודש/workspace, לא לולאת render
    fetchHolidays();
    fetchEvents();
    fetchTasks();
    fetchDocDues();
    // activeWorkspaceId בתלויות בכוונה: כשמחליפים workspace דרך הבורר, הנתונים
    // המוצגים כאן מתרעננים מיד ולא נשארים מהworkspace הקודם עד לניווט מלא.
  }, [mounted, fetchHolidays, fetchEvents, fetchTasks, fetchDocDues, activeWorkspaceId]);

  // כל הפריטים (חגים, אירועים, משימות עם תאריך יעד, מסמכים עם תאריך יעד) מקובצים לפי יום,
  // כדי שיוצגו ישירות בתא של כל יום בתצוגת החודש - בלי צורך ללחוץ על היום
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const push = (date: string, item: CalItem) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    };

    for (const h of holidays) push(h.date, { key: `h-${h.date}-${h.title}`, kind: "holiday", title: h.title });
    for (const e of events)
      push(e.date, {
        key: `e-${e._id}`,
        kind: "event",
        title: e.title,
        id: e._id,
        notes: e.notes,
        color: e.color,
      });
    for (const t of tasks) {
      if (!t.dueDate) continue;
      push(t.dueDate, {
        key: `t-${t._id}`,
        kind: "task",
        title: t.title,
        id: t._id,
        done: t.isDone,
        color: t.color,
      });
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

  async function addEvent() {
    if (!newEventTitle.trim()) return;
    const res = await fetch("/api/calendar-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newEventTitle,
        date: selectedDay,
        notes: newEventNotes,
        color: newEventColor,
      }),
    });
    if (res.ok) {
      setNewEventTitle("");
      setNewEventNotes("");
      setNewEventColor(DEFAULT_EVENT_COLOR);
      fetchEvents();
    }
  }

  async function deleteEvent(id: string) {
    const res = await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
    if (res.ok) fetchEvents();
  }

  function startEditEvent(item: CalItem) {
    if (!item.id) return;
    setEditingEventId(item.id);
    setEditTitle(item.title);
    setEditNotes(item.notes || "");
    setEditColor(item.color || DEFAULT_EVENT_COLOR);
  }

  function cancelEditEvent() {
    setEditingEventId(null);
  }

  async function saveEditEvent() {
    if (!editingEventId || !editTitle.trim()) return;
    const res = await fetch(`/api/calendar-events/${editingEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), notes: editNotes, color: editColor }),
    });
    if (res.ok) {
      setEditingEventId(null);
      fetchEvents();
    }
  }

  const selectedDayLabel = selectedDay ? formatDayHeader(selectedDay) : "";
  const selectedItems = itemsForDay(selectedDay);

  if (!mounted) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">טוען לוח שנה...</div>
    );
  }

  // רקע עדין + טקסט בצבע מלא (לרשימת הפירוט של היום, בניגוד לצ'יפים המלאים ברשת החודש)
  function rowStyle(color: string) {
    return { backgroundColor: `${color}1a`, color };
  }

  function renderItemRow(item: CalItem) {
    if (item.kind === "holiday") {
      return (
        <div key={item.key} className="rounded-xl px-3 py-2 text-sm" style={rowStyle(DEFAULT_KIND_COLOR.holiday)} dir="auto">
          🕎 {item.title}
        </div>
      );
    }
    if (item.kind === "event") {
      const color = item.color || DEFAULT_KIND_COLOR.event;
      if (editingEventId === item.id) {
        return (
          <div key={item.key} className="rounded-xl px-3 py-2 space-y-2 border border-slate-200">
            <input
              className="input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="כותרת"
            />
            <input
              className="input"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="הערות (אופציונלי)"
            />
            <ColorPicker value={editColor} onChange={setEditColor} />
            <div className="flex gap-2">
              <button onClick={saveEditEvent} className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5">
                <Check size={14} /> שמירה
              </button>
              <button
                onClick={cancelEditEvent}
                className="btn-secondary flex items-center gap-1 text-sm px-3 py-1.5"
              >
                <X size={14} /> ביטול
              </button>
            </div>
          </div>
        );
      }
      return (
        <div
          key={item.key}
          className="flex items-start justify-between gap-2 rounded-xl px-3 py-2"
          style={rowStyle(color)}
        >
          <div dir="auto">
            <p className="font-medium text-sm">{item.title}</p>
            {item.notes && <p className="text-xs opacity-80">{item.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => startEditEvent(item)} className="opacity-60 hover:opacity-100">
              <Pencil size={16} />
            </button>
            <button onClick={() => item.id && deleteEvent(item.id)} className="opacity-60 hover:opacity-100 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      );
    }
    if (item.kind === "task") {
      const color = item.color || DEFAULT_KIND_COLOR.task;
      return (
        <Link
          key={item.key}
          href="/tasks"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-opacity hover:opacity-80"
          style={rowStyle(color)}
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
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-opacity hover:opacity-80"
        style={rowStyle(DEFAULT_KIND_COLOR.document)}
        dir="auto"
      >
        <span>📌 {item.title}</span>
        <ExternalLink size={14} className="shrink-0" />
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-2.5 sm:p-4">
        <div className="flex items-center justify-between mb-3 px-1.5">
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

        <div className="grid grid-cols-7 text-center text-[11px] text-slate-400 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {/* רשת החודש: כל תא מציג ישירות את כותרות הפריטים שלו (כמו גוגל קלנדר) -
            בלי צורך ללחוץ על היום. השורה גדלה אוטומטית כשיש בה יום עמוס יותר. */}
        <div className="grid grid-cols-7 gap-[3px]">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = ymd(d);
            const dayItems = itemsForDay(dateStr);
            const visibleItems = dayItems.slice(0, 4);
            const overflowCount = dayItems.length - visibleItems.length;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(dateStr)}
                className={clsx(
                  "min-h-[48px] rounded-md flex flex-col items-stretch gap-[2px] p-[3px] text-right transition-colors",
                  isSelected ? "ring-2 ring-teal-600 bg-teal-50" : "hover:bg-slate-50"
                )}
              >
                <span
                  className={clsx(
                    "text-[11px] leading-none self-end w-4 h-4 flex items-center justify-center rounded-full shrink-0",
                    isToday ? "bg-teal-700 text-white font-semibold" : "text-slate-500"
                  )}
                >
                  {d.getDate()}
                </span>
                {visibleItems.map((item) => (
                  <span
                    key={item.key}
                    dir="auto"
                    className={clsx(
                      "text-[9.5px] sm:text-[10.5px] leading-tight rounded-[3px] px-1 py-[1.5px] truncate w-full text-white",
                      item.kind === "task" && item.done && "opacity-50 line-through"
                    )}
                    style={{ backgroundColor: item.color || DEFAULT_KIND_COLOR[item.kind] }}
                  >
                    {item.title}
                  </span>
                ))}
                {overflowCount > 0 && (
                  <span className="text-[9px] leading-tight px-1 text-slate-400">+{overflowCount} עוד</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* פירוט מלא של היום שנבחר - כותרות מלאות ללא קיצוץ, והוספת אירוע */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">
            {selectedDay === todayStr ? "היום" : selectedDayLabel}
          </h2>
          {selectedDay === todayStr ? (
            <span className="text-xs text-teal-700 bg-teal-50 rounded-full px-2.5 py-1">עכשיו</span>
          ) : (
            <button onClick={() => setSelectedDay(todayStr)} className="text-xs text-teal-700 font-medium">
              חזרה להיום
            </button>
          )}
        </div>
        {selectedDay !== todayStr && (
          <p className="text-sm text-slate-500 -mt-2 mb-3">{selectedDayLabel}</p>
        )}

        <div className="space-y-2 mb-4">
          {selectedItems.map(renderItemRow)}
          {selectedItems.length === 0 && <p className="text-sm text-slate-400">אין אירועים ביום הזה.</p>}
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-2">
          <input
            className="input"
            placeholder="הוסף אירוע חדש ליום הזה..."
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
              <ColorPicker value={newEventColor} onChange={setNewEventColor} />
              <button onClick={addEvent} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={16} /> הוסף אירוע
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 text-xs text-slate-500 px-1 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-500" /> חג/מועד
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-teal-600" /> אירוע
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-violet-600" /> משימה
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-orange-500" /> תאריך יעד למסמך
        </span>
      </div>
    </div>
  );
}
