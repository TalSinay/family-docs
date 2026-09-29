"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Modal } from "./Modal";

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
  const [cursor, setCursor] = useState(() => new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים לפי חודש, לא לולאת render
    fetchHolidays();
    fetchEvents();
  }, [fetchHolidays, fetchEvents]);

  function eventsForDay(dateStr: string) {
    return events.filter((e) => e.date === dateStr);
  }
  function holidaysForDay(dateStr: string) {
    return holidays.filter((h) => h.date === dateStr);
  }

  async function addEvent() {
    if (!selectedDay || !newEventTitle.trim()) return;
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

  const todayStr = ymd(new Date());

  return (
    <div className="space-y-3">
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

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(dateStr)}
                className={clsx(
                  "aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative hover:bg-teal-50 transition-colors",
                  isToday && "bg-teal-700 text-white hover:bg-teal-800"
                )}
              >
                {d.getDate()}
                <div className="flex gap-0.5 mt-0.5">
                  {dayHolidays.length > 0 && (
                    <span className={clsx("w-1.5 h-1.5 rounded-full", isToday ? "bg-white" : "bg-amber-500")} />
                  )}
                  {dayEvents.length > 0 && (
                    <span className={clsx("w-1.5 h-1.5 rounded-full", isToday ? "bg-white" : "bg-teal-600")} />
                  )}
                </div>
              </button>
            );
          })}
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

      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(selectedDay)) : ""}
      >
        {selectedDay && (
          <div className="space-y-4">
            {holidaysForDay(selectedDay).map((h) => (
              <div key={h.title} className="bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-sm">
                🕎 {h.title}
              </div>
            ))}

            <div className="space-y-2">
              {eventsForDay(selectedDay).map((e) => (
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
              {eventsForDay(selectedDay).length === 0 && (
                <p className="text-sm text-slate-400">אין עדיין אירועים ביום הזה.</p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <input
                className="input"
                placeholder="כותרת האירוע"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
              />
              <input
                className="input"
                placeholder="הערות (אופציונלי)"
                value={newEventNotes}
                onChange={(e) => setNewEventNotes(e.target.value)}
              />
              <button onClick={addEvent} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={16} /> הוסף אירוע
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
