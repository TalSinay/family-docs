import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import MonthlyReminder from "@/lib/models/MonthlyReminder";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();
  const reminders = await MonthlyReminder.find({ workspaceId }).sort({ dayOfMonth: 1 }).lean();
  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { title, dayOfMonth } = await req.json();
  const day = Number(dayOfMonth);
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "חסרה כותרת לתזכורת" }, { status: 400 });
  }
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return NextResponse.json({ error: "יום בחודש צריך להיות בין 1 ל-28" }, { status: 400 });
  }

  await connectToDatabase();
  const reminder = await MonthlyReminder.create({
    workspaceId,
    title: String(title).trim(),
    dayOfMonth: day,
    createdBy: session!.user.id,
  });

  return NextResponse.json(reminder, { status: 201 });
}
