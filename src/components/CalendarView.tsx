"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";

type Holiday = { date: string; title: string };
type EventItem = { _id: string; title: string; date: string; notes?: string };

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים לפי חודש, לא לולאת render
    fetchHolidays();
    fetchEvents();
  }, [mounted, fetchHolidays, fetchEvents]);

  function eventsForDay(dateStr: string) {
    return events.filter((e) => e.date === dateStr);
  }
  function holidaysForDay(dateStr: string) {
    return holidays.filter((h) => h.date === dateStr);
  }

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

  // בונים תווית תאריך "ידנית" (בלי new Date(selectedDay)) כדי למנוע כל בעיית פרשנות UTC
  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return "";
    const [y, m, d] = selectedDay.split("-").map(Number);
    return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(y, m - 1, d)
    );
  }, [selectedDay]);

  const selectedHolidays = holidaysForDay(selectedDay);
  const selectedEvents = eventsForDay(selectedDay);

  if (!mounted) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">טוען לוח שנה...</div>
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
            const dayEvents = eventsForDay(dateStr);
            const dayHolidays = holidaysForDay(dateStr);
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
                  {dayHolidays.length > 0 && (
                    <span className={clsx("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : "bg-amber-500")} />
                  )}
                  {dayEvents.length > 0 && (
                    <span className={clsx("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : "bg-teal-600")} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* סדר היום של היום הנבחר - מוצג תמיד, בלי צורך בלחיצה נוספת */}
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
          {selectedHolidays.map((h) => (
            <div key={h.title} className="bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-sm">
              🕎 {h.title}
            </div>
          ))}

          {selectedEvents.map((e) => (
            <div key={e._id} className="flex items-start justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <div>
                <p className="font-medium text-sm">{e.title}</p>
                {e.notes && <p className="text-xs text-slate-500">{e.notes}</p>}
              </div>
              <button onClick={() => deleteEvent(e._id)} className="text-slate-400 hover:text-red-600 shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {selectedHolidays.length === 0 && selectedEvents.length === 0 && (
            <p className="text-sm text-slate-400">אין אירועים ביום הזה.</p>
          )}
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
              <button onClick={addEvent} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={16} /> הוסף אירוע
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> חג/מועד
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600" /> אירוע
        </span>
      </div>
    </div>
  );
}
