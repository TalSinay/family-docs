import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Workspace from "@/lib/models/Workspace";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { name } = await req.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "חסר שם ל-workspace" }, { status: 400 });
  }

  await connectToDatabase();
  const workspace = await Workspace.findByIdAndUpdate(
    id,
    { name: String(name).trim() },
    { new: true }
  );
  if (!workspace) return NextResponse.json({ error: "workspace לא נמצא" }, { status: 404 });

  return NextResponse.json(workspace);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();

  // לא מוחקים workspace שעדיין יש בו חברים, כדי למנוע איבוד גישה בטעות למידע קיים.
  const memberCount = await WorkspaceMembership.countDocuments({ workspaceId: id });
  if (memberCount > 0) {
    return NextResponse.json(
      { error: "לא ניתן למחוק workspace שיש בו עדיין חברים" },
      { status: 400 }
    );
  }

  await Workspace.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
