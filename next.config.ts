import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // מכבה את אינדיקטור הפיתוח (העיגול עם ה-"N") שמופיע בפינת המסך ב-next dev.
  // הוא לא מופיע בפרודקשן ממילא, אבל מפריע בזמן העבודה המקומית.
  // שגיאות קומפילציה/ריצה עדיין יוצגו כרגיל.
  devIndicators: false,
};

export default nextConfig;
