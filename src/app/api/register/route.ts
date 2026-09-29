import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";

const MAX_USERS = 10;

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
    }

    await connectToDatabase();

    const existingCount = await User.countDocuments();
    if (existingCount >= MAX_USERS) {
      return NextResponse.json(
        { error: `האפליקציה מוגבלת ל-${MAX_USERS} משתמשים` },
        { status: 403 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ error: "כבר קיים משתמש עם אימייל זה" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ email: normalizedEmail, passwordHash, name });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
  }
}
