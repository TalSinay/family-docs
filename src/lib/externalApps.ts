// קישורים מהירים לאפליקציות/אתרים חיצוניים (לא קשור למודל המסמכים/הקטגוריות
// הפנימי - זו רשימה נפרדת לגמרי, מנוהלת כאן בקוד). לחיצה פותחת https:// רגיל;
// אם ולאפליקציה המותקנת יש Universal Link רשום לנתיב הזה, ה-OS (לא הקוד שלנו)
// מיירט ופותח אותה במקום הדפדפן - אין API שמאפשר ל-PWA "לנחש" אם זה קרה.
//
// נבדק (ב-/.well-known/apple-app-site-association של כל דומיין, ב-2026-10):
// - Max: יש AASA, אבל רק לנתיבים פנימיים ספציפיים (apple-pay, benefits,
//   loans וכו') - אין נתיב כללי ל"בית"/landing, כך שקישור לדף הבית לא מיירט.
// - בנק דיסקונט (start.telebank.co.il, וגם discountbank.co.il): אין קובץ
//   AASA בכלל בשני הדומיינים - אין שום Universal Link רשום, אז זה לא אפשרי
//   מקישור web בכלל, לא משנה מה ה-path.
// - Cal: יש AASA עם נתיב כללי "/mobile" הרשום להפניה לאפליקציה (Cal4U) -
//   זו ההזדמנות היחידה מבין השלוש; לא אומת בפועל על מכשיר (רק מהקובץ
//   הרשמי), אז כדאי לבדוק בטלפון אם זה בפועל פותח את האפליקציה.
//
// מסקנה: אין ניסיון נוסף של custom-scheme-guessing (כבר ננסה והוסר) - זה
// תלוי אך ורק בהגדרות ה-Universal Link שהחברה עצמה פרסמה, ולא בקוד כאן.
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
  { id: "cal", name: "Cal", url: "https://www.cal-online.co.il/mobile", color: "bg-red-600" },
];
