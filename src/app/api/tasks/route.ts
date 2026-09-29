import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await connectToDatabase();

  // משימות פתוחות קודם (לפי תאריך יעד, ואז לפי תאריך יצירה), ואז משימות שבוצעו בסוף
  const tasks = await Task.find()
    .sort({ isDone: 1, dueDate: 1, createdAt: -1 })
    .populate("createdBy", "name")
    .lean();

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { title, dueDate } = await req.json();
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "חסרה כותרת למשימה" }, { status: 400 });
  }

  await connectToDatabase();
  const task = await Task.create({
    title: String(title).trim(),
    dueDate: dueDate || undefined,
    createdBy: (session.user as { id: string }).id,
  });

  return NextResponse.json(task, { status: 201 });
}
