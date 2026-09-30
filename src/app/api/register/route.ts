import { NextResponse } from "next/server";

// הרשמה עצמית בוטלה - רק admin יכול ליצור משתמשים חדשים (דרך אזור הניהול).
export async function POST() {
  return NextResponse.json(
    { error: "הרשמה עצמית אינה זמינה. פנה למנהל המערכת לקבלת משתמש." },
    { status: 403 }
  );
}
