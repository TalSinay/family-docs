# תיק המשפחה 📁

אפליקציית ניהול מסמכים משפחתית - ביטוחים, פיננסים, זיכויים, קבלות ועוד - עם מעקב הוצאות/הכנסות ולוח שנה עברי. נבנתה כ-PWA שמתקינים ישירות למסך הבית באייפון (או כל טלפון אחר), ב-$0 עלות חודשית.

## הסטאק

| שכבה | טכנולוגיה | עלות |
|---|---|---|
| פרונטאנד + backend | Next.js 16 (App Router), פרוס ל-Vercel | חינם |
| מסד נתונים | MongoDB Atlas (טיר M0) | חינם |
| אימות | Auth.js (NextAuth) עם Credentials, JWT | חינם |
| אוטומציית תשלומים חודשיים | GitHub Actions (cron חודשי) | חינם |
| חגי ישראל | Hebcal API (ציבורי) | חינם |

כל הנתונים - כולל **קובצי הבינארי עצמם** (לא רק מטא-דאטה) - נשמרים ב-MongoDB תחת החשבון שלך בלבד, ללא תלות בשום צד שלישי.

## הקמה מאפס

### 1. מסד נתונים - MongoDB Atlas

1. הרשם ב-[mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) וצור פרויקט חדש.
2. צור Cluster מטיר **M0 (Free)**.
3. תחת **Database Access** - צור משתמש עם סיסמה.
4. תחת **Network Access** - הוסף `0.0.0.0/0` (כדי ש-Vercel יוכל להתחבר; אין IP קבוע בטיר החינמי).
5. לחץ "Connect" → "Drivers" והעתק את ה-connection string (מתחיל ב-`mongodb+srv://`).

### 2. הרצה מקומית

```bash
git clone <כתובת ה-repo שלך>
cd family-docs
npm install
cp .env.example .env.local
```

מלא ב-`.env.local`:
- `MONGODB_URI` - ה-connection string מ-Atlas (הוסף בסופו שם database, לדוגמה `/familydocs`)
- `AUTH_SECRET` - הרץ `openssl rand -base64 32` והדבק את הפלט
- `CRON_SECRET` - מחרוזת אקראית נוספת (לדוגמה גם עם `openssl rand -base64 32`)

```bash
npm run dev
```

פתח [http://localhost:3000](http://localhost:3000), לחץ "הרשמה" וצור את המשתמש הראשון שלך (עד 10 משתמשים בסה"כ).

### 3. פריסה ל-Vercel (חינם)

1. הרשם ב-[vercel.com](https://vercel.com) עם GitHub.
2. "Add New Project" → בחר את ה-repo הזה.
3. תחת Environment Variables הוסף את שלושת המשתנים מ-`.env.local` (עם ה-URI האמיתי, לא placeholder).
4. Deploy.

בסיום תקבל כתובת כמו `https://family-docs-yourname.vercel.app`.

### 4. התקנה על מסך הבית באייפון

1. פתח את הכתובת שקיבלת מ-Vercel ב-**Safari** באייפון.
2. לחץ על כפתור השיתוף (הריבוע עם החץ) → "הוסף למסך הבית".
3. האפליקציה תופיע כאייקון רגיל שנפתח במסך מלא, בלי סרגל כתובות.

חזור על זה בכל טלפון של בן משפחה.

### 5. אוטומציית תשלומים חודשיים (אופציונלי אך מומלץ)

כדי שהמערכת תיצור אוטומטית רשומת הוצאה בתחילת כל חודש עבור מסמכים עם "תשלום חודשי":

1. ב-GitHub, בעמוד ה-repo → Settings → Secrets and variables → Actions.
2. הוסף שני secrets:
   - `APP_URL` - כתובת האפליקציה שלך מ-Vercel (בלי `/` בסוף)
   - `CRON_SECRET` - **בדיוק אותו ערך** שהזנת ב-Vercel
3. ה-workflow ב-`.github/workflows/monthly-expenses.yml` ירוץ אוטומטית פעם בחודש. אפשר גם להריץ ידנית מטאב "Actions" ב-GitHub → "Monthly Expenses Automation" → "Run workflow".

## מגבלות ידועות

- **גודל קובץ מקסימלי: כ-11MB** (מגבלת מסמך MongoDB). מתאים למרבית הסריקות/PDF-ים/תמונות, לא לסרטונים או קבצים כבדים.
- הטיר החינמי של MongoDB Atlas מוגבל ל-512MB אחסון כולל - מספיק בנוחות לשימוש משפחתי (עד 10 משתמשים) לאורך זמן רב.
- אין הרשאות גרנולריות בין משתמשים - כל מי שמחובר לאפליקציה רואה את כל המסמכים (מתאים לשימוש משפחתי פנימי).

## מבנה הפרויקט

```
src/
  app/                 עמודים (App Router) + API routes
  components/          רכיבי React (טופס העלאה, לוח שנה, כרטיסי מסמך...)
  lib/
    models/            סכמות Mongoose (Document, File, User, CalendarEvent, SubCategory)
    categories.ts       הגדרת הקטגוריות ותתי-הקטגוריות
    auth.ts             הגדרת Auth.js
    mongodb.ts           חיבור למסד הנתונים
.github/workflows/     אוטומציית ה-cron החודשי
```
