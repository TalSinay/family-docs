import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";

// עדכון פרטים אישיים (כרגע: שם תצוגה) של המשתמש המחובר עצמו - לא דרך אזור הניהול.
// שינוי שם כאן הוא ברירת המחדל הגלובלית של המשתמש; שם תצוגה מותאם פר-workspace
// (אם הוגדר ע"י admin) עדיין גובר עליו באפליקציה, בדיוק כמו היום.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).select("name email");
  if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  return NextResponse.json({ name: user.name, email: user.email });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "חסר שם" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findByIdAndUpdate(
    session.user.id,
    { name: String(name).trim() },
    { new: true }
  ).select("name email");
  if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  return NextResponse.json({ name: user.name, email: user.email });
}
