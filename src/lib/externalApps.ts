// קישורים מהירים לאפליקציות/אתרים חיצוניים (לא קשור למודל המסמכים/הקטגוריות
// הפנימי - זו רשימה נפרדת לגמרי, מנוהלת כאן בקוד).
//
// אם מוגדר `scheme` - לחיצה מנסה קודם לפתוח את האפליקציה המותקנת ישירות דרך
// custom URL scheme (ראו src/app/apps/page.tsx להסבר על מנגנון ה-fallback),
// ורק אם זה לא הצליח (האפליקציה לא מותקנת, או שה-scheme שגוי) עוברים לאתר.
// זה לא Universal Link רשמי (אלו לא מתועדים/לא נתמכים ע"י החברות האלה), אלא
// ניסיון מיטבי (best-effort) שעלול לא לעבוד לכל אפליקציה/גרסה.
export type ExternalApp = {
  id: string;
  name: string;
  url: string;
  scheme?: string;
  color: string; // רקע לעיגול האייקון
};

export const EXTERNAL_APPS: ExternalApp[] = [
  {
    id: "max",
    name: "Max",
    url: "https://www.max.co.il",
    scheme: "maxit://",
    color: "bg-slate-900",
  },
  {
    id: "discount",
    name: "בנק דיסקונט",
    url: "https://start.telebank.co.il",
    color: "bg-orange-600",
  },
  { id: "cal", name: "Cal", url: "https://www.cal-online.co.il", color: "bg-red-600" },
];
