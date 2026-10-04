import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import MonthlyReminder from "@/lib/models/MonthlyReminder";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await MonthlyReminder.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
