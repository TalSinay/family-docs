import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  await connectToDatabase();
  const event = await CalendarEvent.findOneAndUpdate({ _id: id, workspaceId }, body, {
    new: true,
  });
  if (!event) return NextResponse.json({ error: "אירוע לא נמצא" }, { status: 404 });

  return NextResponse.json(event);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await CalendarEvent.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
