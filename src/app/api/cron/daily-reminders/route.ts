import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import Task from "@/lib/models/Task";
import MonthlyReminder from "@/lib/models/MonthlyReminder";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";
import { sendPushToUsers } from "@/lib/push";

// כמה ימים מראש להתריע על dueDate מתקרב של מסמך (בנוסף להתראה ביום עצמו)
const APPROACHING_DAYS = 3;

// "היום" ו"יום בחודש" מחושבים לפי אזור הזמן של ישראל (לא UTC של השרת), כדי
// שההתראות יישלחו ביום הנכון גם אם ה-cron רץ קרוב לחצות.
function israelToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

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

  const today = israelToday();
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

  let sentCount = 0;

  // 1. משימות שהגיע/עבר תאריך היעד שלהן (ולא סומנו כבוצעו)
  const overdueTasks = await Task.find({
    isDone: false,
    dueDate: { $exists: true, $ne: null, $lte: today },
  }).lean();
  for (const task of overdueTasks) {
    const members = membersByWorkspace.get(task.workspaceId.toString()) || [];
    const isToday = task.dueDate === today;
    await sendPushToUsers(members, {
      title: isToday ? "משימה להיום" : "משימה באיחור",
      body: task.title,
      url: "/tasks",
    });
    sentCount++;
  }

  // 2. מסמכים עם תאריך יעד שהגיע היום, או מתקרב בעוד APPROACHING_DAYS ימים
  const approachingDocs = await DocumentModel.find({
    dueDate: { $in: [today, approachingDate] },
  }).lean();
  for (const doc of approachingDocs) {
    const members = membersByWorkspace.get(doc.workspaceId.toString()) || [];
    const isToday = doc.dueDate === today;
    await sendPushToUsers(members, {
      title: isToday ? "תאריך יעד היום" : `תאריך יעד מתקרב (בעוד ${APPROACHING_DAYS} ימים)`,
      body: doc.dueDateTitle || doc.title,
      url: `/documents/${doc._id}`,
    });
    sentCount++;
  }

  // 3. תזכורות חודשיות חוזרות שחל היום תורן שלהן
  const monthlyReminders = await MonthlyReminder.find({ dayOfMonth: todayDay }).lean();
  for (const reminder of monthlyReminders) {
    const members = membersByWorkspace.get(reminder.workspaceId.toString()) || [];
    await sendPushToUsers(members, {
      title: "תזכורת חודשית",
      body: reminder.title,
      url: "/dashboard",
    });
    sentCount++;
  }

  return NextResponse.json({
    today,
    overdueTasks: overdueTasks.length,
    approachingDocs: approachingDocs.length,
    monthlyReminders: monthlyReminders.length,
    sentCount,
  });
}
