// קישורים מהירים לאפליקציות/אתרים חיצוניים (לא קשור למודל המסמכים/הקטגוריות
// הפנימי - זו רשימה נפרדת לגמרי, מנוהלת כאן בקוד). לחיצה פותחת את האתר הרשמי
// של השירות בדפדפן.
//
// ניסינו גם לפתוח ישירות את אפליקציית Max המותקנת דרך custom URL scheme
// (ניחושים לא מתועדים רשמית: max://, maxcard:// וכו') - זה לא עבד בפועל,
// והוסר. Max/דיסקונט/Cal לא חושפים Universal Link רשמי לדומיינים האלה,
// כך שאין כרגע דרך אמינה לפתוח ישירות את האפליקציה המותקנת מתוך האתר.
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
