import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import Task from "@/lib/models/Task";
import { overlayCreatorDisplayNames } from "@/lib/resolveDisplayNames";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();

  // משימות פתוחות קודם (לפי תאריך יעד, ואז לפי תאריך יצירה), ואז משימות שבוצעו בסוף
  const tasks = await Task.find({ workspaceId })
    .sort({ isDone: 1, dueDate: 1, createdAt: -1 })
    .populate("createdBy", "name")
    .lean();

  return NextResponse.json(await overlayCreatorDisplayNames(workspaceId, tasks));
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { title, dueDate, color } = await req.json();
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "חסרה כותרת למשימה" }, { status: 400 });
  }

  await connectToDatabase();
  const task = await Task.create({
    workspaceId,
    title: String(title).trim(),
    dueDate: dueDate || undefined,
    color: color || undefined,
    createdBy: session!.user.id,
  });

  return NextResponse.json(task, { status: 201 });
}
