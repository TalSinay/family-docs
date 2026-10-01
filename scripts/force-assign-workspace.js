// סקריפט עצמאי חד-פעמי: משייך בכוח את כל התוכן שקיים כרגע ב-DB (מסמכים, אירועי
// יומן, משימות, תתי-קטגוריות) ל-workspace יעד אחד - בלי תלות באיפה הוא כרגע משוייך
// (גם אם הוא לא משוייך בכלל, או משוייך ל-workspace אחר/שגוי/נשכח). שימושי כשכל
// הנתונים הקיימים ב-DB שייכים בפועל למשפחה אחת, ורוצים לוודא שהם "ננעלים" ל-
// workspace הנכון בלי למחוק ולהעלות מחדש.
//
// הרצה (טוען אוטומטית את MONGODB_URI מתוך .env.local):
//   node scripts/force-assign-workspace.js --to="משפחת סיני"
//
// זהירות: זה דורס את ה-workspaceId על כל רשומה קיימת, ללא תנאי. מתאים כשיש רק
// "משפחה" אחת אמיתית עם תוכן אמיתי, ושאר ה-workspace-ים (אם יש) אמורים להישאר ריקים.
// בטוח להרצה כמה פעמים - רק קובע את המצב הסופי.

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

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("חסר MONGODB_URI. ודא ש-.env.local קיים ומכיל אותו.");
  process.exit(1);
}

if (!args.to && !args["to-id"]) {
  console.error(
    'שימוש: node scripts/force-assign-workspace.js --to="שם workspace היעד"\n' +
      "(או --to-id=... לפי מזהה)"
  );
  process.exit(1);
}

(async () => {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.db;
  console.log("✅ מחובר למסד הנתונים");

  try {
    const toWs = args["to-id"]
      ? await db.collection("workspaces").findOne({ _id: new mongoose.Types.ObjectId(args["to-id"]) })
      : await db.collection("workspaces").findOne({ name: args.to });

    if (!toWs) {
      console.error(`❌ לא נמצא workspace יעד: ${args["to-id"] || args.to}`);
      process.exit(1);
    }

    console.log(`משייך את כל התוכן הקיים ב-DB אל "${toWs.name}" (${toWs._id})`);

    // מסמכים, אירועי יומן ומשימות - דריסה ישירה וללא תנאי של workspaceId על כל רשומה.
    for (const collName of ["documents", "calendarevents", "tasks"]) {
      const result = await db
        .collection(collName)
        .updateMany({}, { $set: { workspaceId: toWs._id } });
      console.log(`✅ ${collName}: עודכנו ${result.modifiedCount} מתוך ${result.matchedCount} רשומות`);
    }

    // תתי-קטגוריות - יש אינדקס ייחודי (workspaceId, category, name), אז קודם
    // מאחדים כפילויות (לפי category+name) למסמך אחד, ורק אז משייכים את כולן ליעד.
    const allSubs = await db.collection("subcategories").find({}).toArray();
    const seen = new Map(); // key: "category||name" -> true אחרי שנשמר
    let kept = 0;
    let deduped = 0;
    for (const sub of allSubs) {
      const key = `${sub.category}||${sub.name}`;
      if (seen.has(key)) {
        await db.collection("subcategories").deleteOne({ _id: sub._id });
        deduped++;
      } else {
        seen.set(key, true);
        await db
          .collection("subcategories")
          .updateOne({ _id: sub._id }, { $set: { workspaceId: toWs._id } });
        kept++;
      }
    }
    console.log(`✅ subcategories: ${kept} שויכו ל-"${toWs.name}", ${deduped} כפילויות אוחדו`);

    console.log("\n🎉 השיוך הכפוי הושלם בהצלחה - כל התוכן הקיים שייך עכשיו ל-\"" + toWs.name + "\".");
  } finally {
    await conn.close();
  }
})().catch((err) => {
  console.error("❌ השיוך נכשל:", err);
  process.exit(1);
});
