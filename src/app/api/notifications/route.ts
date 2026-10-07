import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import Task from "@/lib/models/Task";
import MonthlyReminder from "@/lib/models/MonthlyReminder";
import AppSettings from "@/lib/models/AppSettings";
import NotificationLog from "@/lib/models/NotificationLog";
import { DEFAULT_NOTIFICATION_TIME, israelNow } from "@/lib/israelTime";

const APPROACHING_DAYS = 3; // תואם ל-api/cron/daily-reminders
const DOC_HORIZON_DAYS = 180;
const SENT_LIMIT = 40;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

export type ScheduledItem = {
  kind: "monthly" | "task" | "document";
  id: string;
  name: string; // השם הניתן לעריכה (כותרת תזכורת / משימה / כותרת תאריך יעד)
  label: string; // תיאור ההתראה, לדוגמה "תזכורת חודשית", "משימה באיחור"
  nextDate: string; // YYYY-MM-DD של ההתראה הקרובה
  time: string; // HH:MM בפועל
  customTime: boolean; // האם נקבעה שעה ייעודית (ולא הגלובלית)
  // ערכי עריכה
  editDate: string; // monthly: dayOfMonth כמחרוזת; אחרת: dueDate
  editTime: string; // השעה הייעודית או ריק
};

// כל ההתראות של ה-workspace הפעיל: מה מתוזמן להישלח (תזכורות חודשיות, משימות, תאריכי
// יעד של מסמכים), ומה כבר נשלח (יומן). משתמש באותם כללים כמו ה-cron.
export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();

  const { date: today, time: nowTime } = israelNow();
  const settings = await AppSettings.findOne({ key: "global" }).lean();
  const globalTime = settings?.notificationTime || DEFAULT_NOTIFICATION_TIME;
  const [ty, tm, td] = today.split("-").map(Number);

  const [reminders, tasks, docs, sent] = await Promise.all([
    MonthlyReminder.find({ workspaceId }).lean(),
    Task.find({ workspaceId, isDone: false, dueDate: { $exists: true, $ne: null } }).lean(),
    DocumentModel.find({
      workspaceId,
      dueDate: { $gte: today, $lte: addDays(today, DOC_HORIZON_DAYS) },
    })
      .select("title dueDate dueDateTitle notifyTime lastNotifiedOn")
      .lean(),
    NotificationLog.find({ workspaceId }).sort({ sentAt: -1 }).limit(SENT_LIMIT).lean(),
  ]);

  const items: ScheduledItem[] = [];

  for (const r of reminders) {
    const time = r.time || globalTime;
    // התזכורת עוד "בתוקף" להיום אם היום הוא יום התזכורת ועדיין לא נשלחה
    const dueToday = td === r.dayOfMonth && r.lastSentOn !== today;
    let nextDate: string;
    if (dueToday) nextDate = today;
    else {
      let y = ty;
      let m = tm;
      if (td >= r.dayOfMonth) {
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      nextDate = `${y}-${String(m).padStart(2, "0")}-${String(r.dayOfMonth).padStart(2, "0")}`;
    }
    items.push({
      kind: "monthly",
      id: String(r._id),
      name: r.title,
      label: "תזכורת חודשית",
      nextDate,
      time,
      customTime: !!r.time,
      editDate: String(r.dayOfMonth),
      editTime: r.time || "",
    });
  }

  for (const t of tasks) {
    const time = t.notifyTime || globalTime;
    const dueDate = t.dueDate as string;
    let nextDate = dueDate;
    let label = "תאריך יעד של משימה";
    if (dueDate <= today) {
      // באיחור/היום: ההתראה חוזרת מדי יום עד שהמשימה מסומנת כבוצעה
      label = dueDate === today ? "משימה להיום" : "משימה באיחור (חוזרת מדי יום)";
      nextDate = t.lastNotifiedOn === today ? addDays(today, 1) : today;
    }
    items.push({
      kind: "task",
      id: String(t._id),
      name: t.title,
      label,
      nextDate,
      time,
      customTime: !!t.notifyTime,
      editDate: dueDate,
      editTime: t.notifyTime || "",
    });
  }

  for (const d of docs) {
    const dueDate = d.dueDate as string;
    const time = d.notifyTime || globalTime;
    const approachingDate = addDays(dueDate, -APPROACHING_DAYS);
    let nextDate = dueDate;
    let label = `תאריך יעד ב-${formatDay(dueDate)}`;
    if (approachingDate >= today && !(approachingDate === today && d.lastNotifiedOn === today)) {
      nextDate = approachingDate;
      label = `תאריך יעד ב-${formatDay(dueDate)} · התראה ${APPROACHING_DAYS} ימים לפני`;
    } else if (dueDate === today && d.lastNotifiedOn === today) {
      continue; // כבר נשלחה היום ואין עוד התראה על המסמך הזה
    }
    items.push({
      kind: "document",
      id: String(d._id),
      name: d.dueDateTitle || d.title,
      label,
      nextDate,
      time,
      customTime: !!d.notifyTime,
      editDate: dueDate,
      editTime: d.notifyTime || "",
    });
  }

  items.sort((a, b) => (a.nextDate + a.time).localeCompare(b.nextDate + b.time));

  return NextResponse.json({
    now: { date: today, time: nowTime },
    globalTime,
    scheduled: items,
    sent: sent.map((s) => ({
      id: String(s._id),
      kind: s.kind,
      title: s.title,
      body: s.body,
      url: s.url,
      sentAt: s.sentAt,
    })),
  });
}
