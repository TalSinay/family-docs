// סקריפט אבחון עצמאי - לא חלק מהאפליקציה, רק לבדיקה חד-פעמית.
// מריץ שני חיבורים נפרדים ל-Mongo (מדמה את "הרשמה" ואז "התחברות") כדי לבודד
// אם הכשל הוא ברשת/ב-Atlas, או ספציפי לאופן שבו Next.js/mongoose מנהלים חיבורים.
//
// הרצה (טוען אוטומטית את MONGODB_URI מתוך .env.local, אין צורך להעתיק אותו לשורת הפקודה):
//   node scripts/test-mongo.js

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("חסר MONGODB_URI. ודא ש-.env.local קיים בתיקיית השורש של הפרויקט ומכיל אותו.");
  process.exit(1);
}
console.log("נטען MONGODB_URI (מוסתר):", uri.replace(/:[^:@]+@/, ":****@"));

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
