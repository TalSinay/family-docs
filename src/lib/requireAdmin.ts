import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// עזר לכל route תחת /api/admin/* - מוודא ש-session קיים ושהמשתמש הוא admin
// (התקבל אך ורק דרך זרימת ה-2FA ב-/admin/login).
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { session: null, error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  }
  return { session, error: null as null };
}
