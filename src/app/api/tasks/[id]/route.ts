import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import Task from "@/lib/models/Task";

const ALLOWED_FIELDS = ["title", "dueDate", "isDone", "color"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key];
  }
  // "" נשלח כדי לנקות תאריך יעד קיים
  if (update.dueDate === "") update.dueDate = null;

  await connectToDatabase();
  const task = await Task.findOneAndUpdate({ _id: id, workspaceId }, update, { new: true });
  if (!task) return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await Task.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
