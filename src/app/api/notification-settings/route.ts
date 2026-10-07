import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import AppSettings from "@/lib/models/AppSettings";
import { DEFAULT_NOTIFICATION_TIME } from "@/lib/israelTime";

// קריאה בלבד, לכל משתמש מחובר - כדי להציג בטופס התזכורות מהי שעת ברירת המחדל.
export async function GET() {
  const { error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const s = await AppSettings.findOne({ key: "global" }).lean();
  return NextResponse.json({ notificationTime: s?.notificationTime || DEFAULT_NOTIFICATION_TIME });
}
