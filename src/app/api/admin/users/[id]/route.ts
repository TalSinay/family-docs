import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { name, password, role } = await req.json();

  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (role === "admin" || role === "member") update.role = role;
  if (password) {
    if (String(password).length < 6) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
    }
    update.passwordHash = await bcrypt.hash(password, 10);
  }

  const user = await User.findByIdAndUpdate(id, update, { new: true }).select(
    "name email role"
  );
  if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  return NextResponse.json(user);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (id === session!.user.id) {
    return NextResponse.json({ error: "לא ניתן למחוק את המשתמש המחובר" }, { status: 400 });
  }

  await connectToDatabase();
  await WorkspaceMembership.deleteMany({ userId: id });
  await User.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
