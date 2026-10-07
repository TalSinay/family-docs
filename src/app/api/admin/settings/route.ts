import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import AppSettings from "@/lib/models/AppSettings";
import { DEFAULT_NOTIFICATION_TIME, isValidTime } from "@/lib/israelTime";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectToDatabase();
  const s = await AppSettings.findOne({ key: "global" }).lean();
  return NextResponse.json({ notificationTime: s?.notificationTime || DEFAULT_NOTIFICATION_TIME });
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { notificationTime } = await req.json();
  if (!isValidTime(notificationTime)) {
    return NextResponse.json({ error: "שעה לא תקינה (פורמט HH:MM)" }, { status: 400 });
  }
  await connectToDatabase();
  await AppSettings.updateOne(
    { key: "global" },
    { $set: { notificationTime }, $setOnInsert: { key: "global" } },
    { upsert: true }
  );
  return NextResponse.json({ notificationTime });
}
