import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import QuickAddWord from "@/lib/models/QuickAddWord";

// ביטול לימוד (למשל "ביטול" מיד אחרי שלימדנו ביטוי בטעות)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const { id } = await params;
  await connectToDatabase();
  await QuickAddWord.findOneAndDelete({ _id: id, workspaceId });
  return NextResponse.json({ ok: true });
}
