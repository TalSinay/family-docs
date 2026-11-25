import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import PushSubscription from "@/lib/models/PushSubscription";
import { isPushConfigured, sendPushToUsers } from "@/lib/push";

// GET: מצב ההתראות של המשתמש הנוכחי (האם VAPID מוגדר בשרת, כמה מכשירים רשומים).
export async function GET() {
  const { session, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const devices = await PushSubscription.countDocuments({ userId: session!.user.id });
  return NextResponse.json({ vapidConfigured: isPushConfigured(), devices });
}

// POST: שולח התראת בדיקה לכל המכשירים הרשומים של המשתמש הנוכחי ומחזיר מה קרה בפועל.
export async function POST() {
  const { session, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const result = await sendPushToUsers([session!.user.id], {
    title: "בדיקת התראות",
    body: "אם אתה רואה את זה, ההתראות עובדות",
    url: "/notifications",
  });
  return NextResponse.json(result);
}
