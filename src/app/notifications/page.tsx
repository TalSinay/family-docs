"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Repeat,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Kind = "monthly" | "task" | "document";

type Scheduled = {
  kind: Kind;
  id: string;
  name: string;
  label: string;
  nextDate: string;
  time: string;
  customTime: boolean;
  editDate: string;
  editTime: string;
};

type Sent = { id: string; kind: Kind; title: string; body: string; url?: string; sentAt: string };

type Data = {
  now: { date: string; time: string };
  globalTime: string;
  scheduled: Scheduled[];
  sent: Sent[];
};

const KIND_ICON = { monthly: Repeat, task: ListChecks, document: FileText } as const;

function addDaysStr(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

// תאריך YYYY-MM-DD כ"היום" / "מחר" / d.m.yyyy - בלי new Date(str) כדי להימנע מהסטות אזור זמן
function formatDay(dateStr: string, today: string) {
  if (dateStr === today) return "היום";
  if (dateStr === addDaysStr(today, 1)) return "מחר";
  const [y, m, d] = dateStr.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

function endpoint(kind: Kind, id: string) {
  if (kind === "monthly") return `/api/monthly-reminders/${id}`;
  if (kind === "task") return `/api/tasks/${id}`;
  return `/api/documents/${id}`;
}

export default function NotificationsPage() {
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) setData(await res.json());
    else setError("שגיאה בטעינת ההתראות");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינה בעלייה/החלפת workspace, לא לולאת render
    load();
  }, [load, activeWorkspaceId]);

  // --- עריכה ---
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(item: Scheduled) {
    setEditingKey(`${item.kind}:${item.id}`);
    setEditName(item.name);
    setEditDate(item.editDate);
    setEditTime(item.editTime);
    setError("");
  }

  async function saveEdit(item: Scheduled) {
    if (!editName.trim()) {
      setError("חסר שם להתראה");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let payload: Record<string, unknown>;
      if (item.kind === "monthly") {
        payload = { title: editName.trim(), dayOfMonth: Number(editDate), time: editTime };
      } else if (item.kind === "task") {
        payload = { title: editName.trim(), dueDate: editDate, notifyTime: editTime };
      } else {
        payload = { dueDateTitle: editName.trim(), dueDate: editDate, notifyTime: editTime };
      }
      const res = await fetch(endpoint(item.kind, item.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "שמירה נכשלה");
      }
      setEditingKey(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  // תזכורת חודשית נמחקת. במשימה/מסמך ההתראה נגזרת מתאריך היעד, ולכן "מחיקה" מסירה את
  // תאריך היעד (והשעה) - המשימה/המסמך עצמם נשארים.
  async function deleteScheduled(item: Scheduled) {
    const msg =
      item.kind === "monthly"
        ? "למחוק את התזכורת החודשית?"
        : item.kind === "task"
        ? "להסיר את ההתראה? תאריך היעד יוסר מהמשימה (המשימה עצמה תישאר)."
        : "להסיר את ההתראה? תאריך היעד יוסר מהמסמך (המסמך עצמו יישאר).";
    if (!confirm(msg)) return;
    setError("");
    let res: Response;
    if (item.kind === "monthly") {
      res = await fetch(endpoint("monthly", item.id), { method: "DELETE" });
    } else {
      const clear =
        item.kind === "task"
          ? { dueDate: "", notifyTime: "" }
          : { dueDate: "", dueDateTitle: "", notifyTime: "" };
      res = await fetch(endpoint(item.kind, item.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clear),
      });
    }
    if (!res.ok) setError("המחיקה נכשלה");
    load();
  }

  async function deleteSent(id: string) {
    setData((prev) => (prev ? { ...prev, sent: prev.sent.filter((s) => s.id !== id) } : prev));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  }

  // --- הוספת תזכורת חודשית ---
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDay, setNewDay] = useState("1");
  const [newTime, setNewTime] = useState("");
  const [adding, setAdding] = useState(false);

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/monthly-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          dayOfMonth: Number(newDay),
          time: newTime || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "יצירת התזכורת נכשלה");
      }
      setNewTitle("");
      setNewDay("1");
      setNewTime("");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת התזכורת נכשלה");
    } finally {
      setAdding(false);
    }
  }

  const globalTime = data?.globalTime || "09:00";
  const today = data?.now.date || "";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell size={20} /> התראות
          </h1>
          <p className="text-sm text-slate-500">
            שעה כללית: {globalTime} · התראות על משימות ותאריכי יעד נוצרות אוטומטית
          </p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="btn-primary flex items-center gap-1 shrink-0">
          <Plus size={16} /> תזכורת
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

      {showAdd && (
        <form onSubmit={addReminder} className="card p-4 space-y-3">
          <p className="font-medium">תזכורת חודשית חוזרת</p>
          <div>
            <label className="label">מה להזכיר?</label>
            <textarea
              className="input min-h-[72px]"
              placeholder="לדוגמה: להעלות תלוש שכר - דניאל"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="w-24">
              <label className="label">יום בחודש</label>
              <input
                type="number"
                min="1"
                max="28"
                className="input text-center"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">שעה</label>
              <input type="time" className="input" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">ריק = שעה כללית ({globalTime})</p>
            </div>
          </div>
          {newTitle.trim() && (
            <p className="text-sm text-slate-600 bg-teal-50 rounded-lg px-3 py-2">
              תישלח ב-{Number(newDay) || 1} לכל חודש בשעה {newTime || globalTime}:{" "}
              <span className="font-medium">{newTitle.trim()}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Plus size={16} /> {adding ? "מוסיף..." : "הוספת תזכורת"}
          </button>
        </form>
      )}

      {!data && !error && <p className="text-sm text-slate-400 text-center py-8">טוען...</p>}

      {data && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
              <CalendarClock size={16} /> מתוזמנות ({data.scheduled.length})
            </h2>
            {data.scheduled.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">אין התראות מתוזמנות.</p>
            )}
            {data.scheduled.map((item) => {
              const key = `${item.kind}:${item.id}`;
              const Icon = KIND_ICON[item.kind];
              const isEditing = editingKey === key;
              return (
                <div key={key} className="card p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="label">שם ההתראה</label>
                        <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="flex gap-3">
                        <div className={item.kind === "monthly" ? "w-24" : "flex-1"}>
                          <label className="label">{item.kind === "monthly" ? "יום בחודש" : "תאריך"}</label>
                          {item.kind === "monthly" ? (
                            <input
                              type="number"
                              min="1"
                              max="28"
                              className="input text-center"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                          ) : (
                            <input
                              type="date"
                              className="input"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="label">שעה</label>
                          <input
                            type="time"
                            className="input"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                          />
                          <p className="text-xs text-slate-400 mt-1">ריק = שעה כללית ({globalTime})</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveEdit(item)}
                          className="btn-primary flex items-center gap-1 disabled:opacity-60"
                        >
                          <Check size={16} /> {saving ? "שומר..." : "שמירה"}
                        </button>
                        <button type="button" onClick={() => setEditingKey(null)} className="btn-secondary flex items-center gap-1">
                          <X size={16} /> ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium break-words">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className="text-sm text-teal-800 mt-1">
                          {formatDay(item.nextDate, today)} בשעה {item.time}
                          {!item.customTime && <span className="text-xs text-slate-400"> (שעה כללית)</span>}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                          aria-label="עריכת התראה"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteScheduled(item)}
                          className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          aria-label="מחיקת התראה"
                          title="מחיקת התראה"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 size={16} /> נשלחו ({data.sent.length})
            </h2>
            {data.sent.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">עדיין לא נשלחו התראות.</p>
            )}
            {data.sent.map((s) => {
              const Icon = KIND_ICON[s.kind];
              const content = (
                <>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-words">{s.body}</p>
                    <p className="text-xs text-slate-500">{s.title}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(s.sentAt)}</p>
                  </div>
                </>
              );
              return (
                <div key={s.id} className="card p-3.5 flex items-start gap-1">
                  {s.url ? (
                    <Link href={s.url} className="flex items-start gap-3 flex-1 min-w-0">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 flex-1 min-w-0">{content}</div>
                  )}
                  <button
                    onClick={() => deleteSent(s.id)}
                    className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600 shrink-0"
                    aria-label="מחיקה מהיומן"
                    title="מחיקה מהיומן"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <p className="text-xs text-slate-400">נשמרות 40 ההתראות האחרונות, עד 60 יום.</p>
          </section>
        </>
      )}
    </div>
  );
}
