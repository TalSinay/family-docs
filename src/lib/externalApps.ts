// קישורים מהירים לאפליקציות/אתרים חיצוניים (לא קשור למודל המסמכים/הקטגוריות
// הפנימי - זו רשימה נפרדת לגמרי, מנוהלת כאן בקוד).
//
// אם מוגדר `schemes` - לחיצה מנסה ברצף כמה custom URL schemes מועמדים (ראו
// src/app/apps/page.tsx להסבר על מנגנון ה-fallback), ורק אם אף אחד מהם לא
// הצליח (האפליקציה לא מותקנת, או שאף ניחוש לא נכון) עוברים לאתר.
//
// חשוב: אלו ניחושים בלבד, לא מתועדים רשמית ע"י Max/דיסקונט/Cal (חיפשתי
// בחיפוש ברשת ולא מצאתי scheme מאומת ציבורית ל-Max) - אין Universal Link
// רשמי כאן. אם המשתמש מגלה בפועל איזה scheme עובד (למשל ע"י הקלדה ידנית
// בשורת הכתובת של הדפדפן בטלפון), אפשר לעדכן כאן את הרשימה.
export type ExternalApp = {
  id: string;
  name: string;
  url: string;
  schemes?: string[];
  color: string; // רקע לעיגול האייקון
};

export const EXTERNAL_APPS: ExternalApp[] = [
  {
    id: "max",
    name: "Max",
    url: "https://www.max.co.il",
    // ניחושים לפי שם החברה (Max IT Finance, לשעבר לאומי קארד) - לא מאומתים.
    schemes: ["max://", "maxcard://", "maxitfinance://", "leumicard://", "maxit://"],
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
