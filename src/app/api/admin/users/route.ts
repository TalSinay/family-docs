import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectToDatabase();
  const users = await User.find().select("name email role createdAt").sort({ createdAt: 1 }).lean();
  return NextResponse.json(users);
}

// יצירת משתמש חדש ע"י admin בלבד - אין הרשמה עצמית באפליקציה.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
  }

  await connectToDatabase();
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return NextResponse.json({ error: "כבר קיים משתמש עם אימייל זה" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: role === "admin" ? "admin" : "member",
  });

  return NextResponse.json(
    { _id: user._id, name: user.name, email: user.email, role: user.role },
    { status: 201 }
  );
}
