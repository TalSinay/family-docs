import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { generateOtpCode, sendAdminPasswordResetEmail } from "@/lib/resend";

// שלב 1 של "שכחתי סיסמה": שולח קוד איפוס למייל, אם קיים admin עם המייל הזה.
// מחזיר תמיד תשובה גנרית (גם אם לא נמצא משתמש) כדי לא לחשוף אילו כתובות מייל קיימות במערכת.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "חסר אימייל" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (user && user.role === "admin") {
      const code = generateOtpCode();
      user.resetCodeHash = await bcrypt.hash(code, 10);
      user.resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      user.resetAttempts = 0;
      await user.save();
      await sendAdminPasswordResetEmail(user.email, code);
    }

    return NextResponse.json({
      ok: true,
      message: "אם קיים משתמש admin עם האימייל הזה, נשלח אליו קוד לאיפוס סיסמה.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
  }
}
