import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

// עריכת שם התצוגה של משתמש בתוך workspace ספציפי (לדוגמה: "טל" -> "דן")
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id, userId } = await params;
  const { displayName } = await req.json();

  await connectToDatabase();
  const membership = await WorkspaceMembership.findOneAndUpdate(
    { workspaceId: id, userId },
    { displayName: displayName?.trim() || undefined },
    { new: true }
  );
  if (!membership) return NextResponse.json({ error: "שיוך לא נמצא" }, { status: 404 });

  return NextResponse.json(membership);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id, userId } = await params;
  await connectToDatabase();
  await WorkspaceMembership.findOneAndDelete({ workspaceId: id, userId });

  return NextResponse.json({ ok: true });
}
