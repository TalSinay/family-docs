import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import MonthlyReminder from "@/lib/models/MonthlyReminder";
import AppSettings from "@/lib/models/AppSettings";
import { DEFAULT_NOTIFICATION_TIME, isValidTime, israelNow } from "@/lib/israelTime";

// עריכת תזכורת חודשית: כותרת, יום בחודש ושעה. אחרי עריכה, אם היום והשעה החדשים עדיין
// לפנינו (היום) - התזכורת תישלח; אם כבר עברו - היא תחל מהחודש הבא.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  await connectToDatabase();
  const reminder = await MonthlyReminder.findOne({ _id: id, workspaceId });
  if (!reminder) return NextResponse.json({ error: "תזכורת לא נמצאה" }, { status: 404 });

  if ("title" in body) {
    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: "חסרה כותרת לתזכורת" }, { status: 400 });
    }
    reminder.title = String(body.title).trim();
  }
  if ("dayOfMonth" in body) {
    const day = Number(body.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return NextResponse.json({ error: "יום בחודש צריך להיות בין 1 ל-28" }, { status: 400 });
    }
    reminder.dayOfMonth = day;
  }
  if ("time" in body) {
    if (body.time === "" || body.time === null) reminder.time = undefined;
    else if (!isValidTime(body.time)) {
      return NextResponse.json({ error: "שעה לא תקינה (פורמט HH:MM)" }, { status: 400 });
    } else reminder.time = body.time;
  }

  const { date: today, time: nowTime } = israelNow();
  const settings = await AppSettings.findOne({ key: "global" }).lean();
  const effectiveTime = reminder.time || settings?.notificationTime || DEFAULT_NOTIFICATION_TIME;
  const passedToday = Number(today.split("-")[2]) === reminder.dayOfMonth && nowTime >= effectiveTime;
  reminder.lastSentOn = passedToday ? today : undefined;

  await reminder.save();
  return NextResponse.json(reminder);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await MonthlyReminder.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
