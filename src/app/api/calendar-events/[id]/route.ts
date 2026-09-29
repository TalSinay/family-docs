import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  await connectToDatabase();
  const event = await CalendarEvent.findByIdAndUpdate(id, body, { new: true });
  if (!event) return NextResponse.json({ error: "אירוע לא נמצא" }, { status: 404 });

  return NextResponse.json(event);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await CalendarEvent.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
