import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { generateOtpCode, sendAdminOtpEmail } from "@/lib/resend";

const GENERIC_ERROR = "פרטי הכניסה שגויים";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const code = generateOtpCode();
    user.otpCodeHash = await bcrypt.hash(code, 10);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    await sendAdminOtpEmail(user.email, code);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
  }
}
