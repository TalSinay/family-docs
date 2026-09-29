// סקריפט אבחון עצמאי - לא חלק מהאפליקציה, רק לבדיקה חד-פעמית.
// מריץ שני חיבורים נפרדים ל-Mongo (מדמה את "הרשמה" ואז "התחברות") כדי לבודד
// אם הכשל הוא ברשת/ב-Atlas, או ספציפי לאופן שבו Next.js/mongoose מנהלים חיבורים.
//
// הרצה: MONGODB_URI="..." node scripts/test-mongo.js
// (או: ודא ש-.env.local קיים ותריץ: node -r dotenv/config scripts/test-mongo.js dotenv_config_path=.env.local)

const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("חסר MONGODB_URI. הרץ עם: MONGODB_URI=\"...\" node scripts/test-mongo.js");
  process.exit(1);
}

async function attempt(label) {
  console.log(`\n--- ניסיון: ${label} ---`);
  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  console.log(`✅ ${label}: התחברות הצליחה`);
  const admin = conn.db.admin();
  const result = await admin.ping();
  console.log(`✅ ${label}: ping הצליח`, result);
  await conn.close();
  console.log(`   (נסגר בניקיון)`);
}

(async () => {
  try {
    await attempt("חיבור ראשון (מדמה הרשמה)");
  } catch (err) {
    console.error("❌ חיבור ראשון נכשל:", err.message);
  }

  await new Promise((r) => setTimeout(r, 1500));

  try {
    await attempt("חיבור שני (מדמה התחברות)");
  } catch (err) {
    console.error("❌ חיבור שני נכשל:", err.message);
  }

  await new Promise((r) => setTimeout(r, 1500));

  try {
    await attempt("חיבור שלישי");
  } catch (err) {
    console.error("❌ חיבור שלישי נכשל:", err.message);
  }

  process.exit(0);
})();
