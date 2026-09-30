import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  const members = await WorkspaceMembership.find({ workspaceId: id })
    .populate("userId", "name email role")
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json(members);
}

// הוספת משתמש קיים ל-workspace (יצירת משתמש חדש נעשית ב-/api/admin/users)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { userId, displayName } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "חסר userId" }, { status: 400 });
  }

  await connectToDatabase();
  try {
    const membership = await WorkspaceMembership.create({
      workspaceId: id,
      userId,
      displayName: displayName || undefined,
    });
    return NextResponse.json(membership, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return NextResponse.json({ error: "המשתמש כבר חבר ב-workspace הזה" }, { status: 409 });
    }
    throw err;
  }
}
