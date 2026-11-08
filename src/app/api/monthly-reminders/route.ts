import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import MonthlyReminder from "@/lib/models/MonthlyReminder";
import AppSettings from "@/lib/models/AppSettings";
import { DEFAULT_NOTIFICATION_TIME, isValidTime, israelNow } from "@/lib/israelTime";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();
  const reminders = await MonthlyReminder.find({ workspaceId }).sort({ oneTimeDate: 1, dayOfMonth: 1 }).lean();
  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { title, dayOfMonth, time, oneTimeDate } = await req.json();
  const isOneTime = typeof oneTimeDate === "string" && oneTimeDate !== "";
  const day = Number(dayOfMonth);
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "חסרה כותרת לתזכורת" }, { status: 400 });
  }
  if (isOneTime && !/^\d{4}-\d{2}-\d{2}$/.test(oneTimeDate)) {
    return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
  }
  if (!isOneTime && (!Number.isInteger(day) || day < 1 || day > 28)) {
    return NextResponse.json({ error: "יום בחודש צריך להיות בין 1 ל-28" }, { status: 400 });
  }

  if (time !== undefined && time !== null && time !== "" && !isValidTime(time)) {
    return NextResponse.json({ error: "שעה לא תקינה (פורמט HH:MM)" }, { status: 400 });
  }
  const customTime = isValidTime(time) ? time : undefined;

  await connectToDatabase();

  // אם התזכורת נוצרת ליום של היום ושעתה כבר עברה - לא שולחים אותה מיד בריצה הבאה,
  // היא תחול רק מהחודש הבא.
  const { date: today, time: nowTime } = israelNow();
  const settings = await AppSettings.findOne({ key: "global" }).lean();
  const effectiveTime = customTime || settings?.notificationTime || DEFAULT_NOTIFICATION_TIME;
  if (isOneTime && oneTimeDate < today) {
    return NextResponse.json({ error: "התאריך כבר עבר" }, { status: 400 });
  }
  const alreadyPassedToday = isOneTime
    ? oneTimeDate === today && nowTime >= effectiveTime
    : Number(today.split("-")[2]) === day && nowTime >= effectiveTime;

  const reminder = await MonthlyReminder.create({
    workspaceId,
    title: String(title).trim(),
    ...(isOneTime ? { oneTimeDate } : { dayOfMonth: day }),
    time: customTime,
    lastSentOn: alreadyPassedToday ? today : undefined,
    createdBy: session!.user.id,
  });

  return NextResponse.json(reminder, { status: 201 });
}
