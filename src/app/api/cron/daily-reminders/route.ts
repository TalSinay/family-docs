import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import Task from "@/lib/models/Task";
import MonthlyReminder from "@/lib/models/MonthlyReminder";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";
import AppSettings from "@/lib/models/AppSettings";
import NotificationLog from "@/lib/models/NotificationLog";
import { sendPushToUsers } from "@/lib/push";
import { DEFAULT_NOTIFICATION_TIME, israelNow } from "@/lib/israelTime";

// כמה ימים מראש להתריע על dueDate מתקרב של מסמך (בנוסף להתראה ביום עצמו)
const APPROACHING_DAYS = 3;

// חישוב תאריך "בעוד N ימים" כחיבור לוחני טהור (Y/M/D), בלי אריתמטיקת זמן/UTC shift -
// עקבי עם המוסכמה הקיימת בקוד (parseLocalDate וכו').
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  await connectToDatabase();

  // ה-cron רץ בתדירות גבוהה (כל 5-30 דקות). כל פריט נשלח בפעם הראשונה שהשעה הנוכחית (שעון ישראל) הגיעה
  // לשעה שנקבעה לו באותו יום, ומסומן כ"נשלח" כדי שלא יישלח שוב.
  const { date: today, time: nowTime } = israelNow();
  await AppSettings.updateOne(
    { key: "global" },
    { $setOnInsert: { key: "global", notificationTime: DEFAULT_NOTIFICATION_TIME } },
    { upsert: true }
  );
  const settings = await AppSettings.findOne({ key: "global" }).lean();
  const globalTime = settings?.notificationTime || DEFAULT_NOTIFICATION_TIME;

  let sentCount = 0;
  const todayDay = Number(today.split("-")[2]);
  const approachingDate = addDays(today, APPROACHING_DAYS);

  // workspaceId -> userId[] (כל חברי ה-workspace), נטען פעם אחת ומשומש לכל הסוגים
  const memberships = await WorkspaceMembership.find({}).select("workspaceId userId").lean();
  const membersByWorkspace = new Map<string, string[]>();
  for (const m of memberships) {
    const wsId = m.workspaceId.toString();
    const list = membersByWorkspace.get(wsId) || [];
    list.push(m.userId.toString());
    membersByWorkspace.set(wsId, list);
  }


  // כל פריט (משימה / תאריך יעד של מסמך / תזכורת חודשית) נשלח בפעם הראשונה שהשעה הנוכחית
  // הגיעה לשעה שנקבעה לו (notifyTime, או השעה הגלובלית אם לא נקבעה), ומסומן כ"נשלח היום"
  // באופן אטומי כדי שריצות חופפות לא ישלחו פעמיים. כל שליחה נרשמת ביומן ההתראות.
  type Model = typeof Task | typeof DocumentModel | typeof MonthlyReminder;
  async function claim(model: Model, id: unknown, field: "lastNotifiedOn" | "lastSentOn") {
    const res = await (model as typeof Task).updateOne(
      { _id: id, [field]: { $ne: today } },
      { $set: { [field]: today } }
    );
    return res.modifiedCount === 1;
  }
  async function notify(
    workspaceId: string,
    kind: "monthly" | "task" | "document",
    payload: { title: string; body: string; url: string }
  ) {
    const members = membersByWorkspace.get(workspaceId) || [];
    await sendPushToUsers(members, payload);
    await NotificationLog.create({ workspaceId, kind, ...payload });
    sentCount++;
  }

  // 1. משימות שהגיע/עבר תאריך היעד שלהן (ולא סומנו כבוצעו)
  const overdueTasks = await Task.find({
    isDone: false,
    dueDate: { $exists: true, $ne: null, $lte: today },
    lastNotifiedOn: { $ne: today },
  }).lean();
  let tasksSent = 0;
  for (const task of overdueTasks) {
    if (nowTime < (task.notifyTime || globalTime)) continue;
    if (!(await claim(Task, task._id, "lastNotifiedOn"))) continue;
    await notify(task.workspaceId.toString(), "task", {
      title: task.dueDate === today ? "משימה להיום" : "משימה באיחור",
      body: task.title,
      url: "/tasks",
    });
    tasksSent++;
  }

  // 2. מסמכים עם תאריך יעד שהגיע היום, או מתקרב בעוד APPROACHING_DAYS ימים
  const approachingDocs = await DocumentModel.find({
    dueDate: { $in: [today, approachingDate] },
    lastNotifiedOn: { $ne: today },
  }).lean();
  let docsSent = 0;
  for (const doc of approachingDocs) {
    if (nowTime < (doc.notifyTime || globalTime)) continue;
    if (!(await claim(DocumentModel, doc._id, "lastNotifiedOn"))) continue;
    await notify(doc.workspaceId.toString(), "document", {
      title:
        doc.dueDate === today
          ? "תאריך יעד היום"
          : `תאריך יעד מתקרב (בעוד ${APPROACHING_DAYS} ימים)`,
      body: doc.dueDateTitle || doc.title,
      url: `/documents/${doc._id}`,
    });
    docsSent++;
  }

  // 3. תזכורות חודשיות חוזרות שחל היום תורן שלהן
  const candidates = await MonthlyReminder.find({
    dayOfMonth: todayDay,
    lastSentOn: { $ne: today },
  }).lean();
  let monthlySent = 0;
  for (const reminder of candidates) {
    if (nowTime < (reminder.time || globalTime)) continue;
    if (!(await claim(MonthlyReminder, reminder._id, "lastSentOn"))) continue;
    await notify(reminder.workspaceId.toString(), "monthly", {
      title: "תזכורת חודשית",
      body: reminder.title,
      url: "/notifications",
    });
    monthlySent++;
  }

  return NextResponse.json({
    today,
    overdueTasks: tasksSent,
    approachingDocs: docsSent,
    nowTime,
    globalTime,
    monthlyReminders: monthlySent,
    sentCount,
  });
}
