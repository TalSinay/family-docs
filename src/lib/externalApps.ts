// קישורים מהירים לאפליקציות/אתרים חיצוניים (לא קשור למודל המסמכים/הקטגוריות
// הפנימי - זו רשימה נפרדת לגמרי, מנוהלת כאן בקוד). לחיצה פותחת את הכתובת הרשמית
// של השירות; אם לטלפון מותקנת האפליקציה הרשמית והיא רשומה כ-Universal/App Link
// עבור הדומיין הזה, מערכת ההפעלה תפתח את האפליקציה במקום הדפדפן.
export type ExternalApp = {
  id: string;
  name: string;
  url: string;
  color: string; // רקע לעיגול האייקון
};

export const EXTERNAL_APPS: ExternalApp[] = [
  { id: "max", name: "Max", url: "https://www.max.co.il", color: "bg-slate-900" },
  {
    id: "discount",
    name: "בנק דיסקונט",
    url: "https://start.telebank.co.il",
    color: "bg-orange-600",
  },
  { id: "cal", name: "Cal", url: "https://www.cal-online.co.il", color: "bg-red-600" },
];
