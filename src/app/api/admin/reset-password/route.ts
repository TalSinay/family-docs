import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";

const GENERIC_ERROR = "קוד האיפוס שגוי או שפג תוקפו";

// שלב 2 של "שכחתי סיסמה": מאמת את הקוד שנשלח למייל וקובע סיסמה חדשה.
export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if (!user.resetCodeHash || !user.resetExpiresAt || user.resetExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if ((user.resetAttempts ?? 0) >= 5) {
      return NextResponse.json(
        { error: "יותר מדי ניסיונות שגויים - בקש קוד איפוס חדש" },
        { status: 400 }
      );
    }

    const validCode = await bcrypt.compare(String(code), user.resetCodeHash);
    if (!validCode) {
      user.resetAttempts = (user.resetAttempts ?? 0) + 1;
      await user.save();
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    // קוד חד-פעמי - מבוטל מיד לאחר שימוש מוצלח, וכל OTP קודם של הכניסה הרגילה גם מתבטל
    // ליתר ביטחון (שינוי סיסמה הוא אירוע רגיש).
    user.resetCodeHash = undefined;
    user.resetExpiresAt = undefined;
    user.resetAttempts = 0;
    user.otpCodeHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
  }
}
