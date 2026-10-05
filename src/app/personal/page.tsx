import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, UserCircle, ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// עמוד "אזור אישי" - מרכז גישה לפרופיל ולאזור הניהול. מוגבל למשתמש admin בלבד.
// הקישור לאזור הניהול מבוסס על role (ולא על isAdmin) בכוונה: אם חלון 48 השעות
// מאז אימות ה-OTP פג, /admin יפנה אוטומטית למסך האימות (proxy.ts).
export default async function PersonalAreaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/categories");

  const items = [
    { href: "/profile", label: "הפרופיל שלי", hint: "שם, סיסמה, התראות ותזכורות", Icon: UserCircle },
    { href: "/admin", label: "אזור ניהול", hint: "ניהול משתמשים וגיבוי נתונים", Icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">אזור אישי</h1>
      <div className="space-y-2">
        {items.map(({ href, label, hint, Icon }) => (
          <Link
            key={href}
            href={href}
            className="card flex items-center gap-3 p-4 hover:border-teal-300 transition-colors"
          >
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{label}</p>
              <p className="text-xs text-slate-500">{hint}</p>
            </div>
            <ChevronLeft size={18} className="text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
