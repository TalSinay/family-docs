// סקריפט עצמאי לאיפוס סיסמה של משתמש קיים (למשל אם שכחת את סיסמת ה-admin).
// לא נוגע בשום דבר אחר ברשומה - רק מחליף את ה-hash של הסיסמה.
//
// הרצה (טוען אוטומטית את MONGODB_URI מתוך .env.local):
//   node scripts/reset-password.js --email=you@example.com --password="סיסמה-חדשה-כלשהי"

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

loadEnvLocal();
const args = parseArgs();
const email = args.email;
const password = args.password;

if (!email || !password) {
  console.error('שימוש: node scripts/reset-password.js --email=you@example.com --password="סיסמה חדשה"');
  process.exit(1);
}
if (password.length < 6) {
  console.error("הסיסמה חייבת להכיל לפחות 6 תווים");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("חסר MONGODB_URI. ודא ש-.env.local קיים ומכיל אותו.");
  process.exit(1);
}

(async () => {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.db;
  console.log("✅ מחובר למסד הנתונים");

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user) {
      console.error(`❌ לא נמצא משתמש עם האימייל ${normalizedEmail}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: { passwordHash },
        // מנקה גם קוד OTP קודם (אם יש), ליתר ביטחון
        $unset: { otpCodeHash: "", otpExpiresAt: "", otpAttempts: "" },
      }
    );

    console.log(`🎉 הסיסמה של ${normalizedEmail} עודכנה בהצלחה.`);
  } finally {
    await conn.close();
  }
})().catch((err) => {
  console.error("❌ האיפוס נכשל:", err);
  process.exit(1);
});
