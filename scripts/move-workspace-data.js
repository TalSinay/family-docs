// סקריפט עצמאי חד-פעמי: מעביר את כל הנתונים (מסמכים, אירועי יומן, משימות,
// תתי-קטגוריות) מ-workspace אחד לאחר. שימושי כשמידע ישן "נחת" בטעות ב-workspace
// הלא נכון (לדוגמה: סקריפט ההגירה רץ לפני שה-workspace הנכון נוצר, או עם שם לא
// מתוכנן), והאדמין רוצה להעביר את כולו ל-workspace הנכון בלי לגעת בחברי ה-workspace
// עצמם (חברויות לא מושפעות - רק התוכן).
//
// הרצה (טוען אוטומטית את MONGODB_URI מתוך .env.local):
//   node scripts/move-workspace-data.js --from="משפחת זגורי" --to="משפחת סיני"
//
// אפשר גם לפי מזהה (_id) במקום שם, עם --from-id / --to-id.
// בטוח להרצה כמה פעמים - אחרי שהועבר, לא יועבר שוב (ה-workspaceId כבר לא תואם את המקור).

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

if ((!args.from && !args["from-id"]) || (!args.to && !args["to-id"])) {
  console.error(
    'שימוש: node scripts/move-workspace-data.js --from="שם workspace מקור" --to="שם workspace יעד"\n' +
      "(או --from-id=... / --to-id=... לפי מזהה)"
  );
  process.exit(1);
}

(async () => {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.db;
  console.log("✅ מחובר למסד הנתונים");

  try {
    const findWorkspace = async (nameArg, idArg, label) => {
      const query = idArg
        ? { _id: new mongoose.Types.ObjectId(idArg) }
        : { name: nameArg };
      const ws = await db.collection("workspaces").findOne(query);
      if (!ws) {
        console.error(`❌ לא נמצא workspace ${label}: ${idArg || nameArg}`);
        process.exit(1);
      }
      return ws;
    };

    const fromWs = await findWorkspace(args.from, args["from-id"], "מקור");
    const toWs = await findWorkspace(args.to, args["to-id"], "יעד");

    if (fromWs._id.toString() === toWs._id.toString()) {
      console.error("❌ ה-workspace המקור והיעד זהים - אין מה להעביר");
      process.exit(1);
    }

    console.log(`מעביר מ-"${fromWs.name}" (${fromWs._id}) אל "${toWs.name}" (${toWs._id})`);

    // מסמכים, אירועי יומן ומשימות - אין מגבלת ייחודיות, אפשר להעביר ישירות
    for (const collName of ["documents", "calendarevents", "tasks"]) {
      const result = await db
        .collection(collName)
        .updateMany({ workspaceId: fromWs._id }, { $set: { workspaceId: toWs._id } });
      console.log(`✅ ${collName}: הועברו ${result.modifiedCount} רשומות`);
    }

    // תתי-קטגוריות - יש אינדקס ייחודי (workspaceId, category, name), אז אם כבר
    // קיימת תת-קטגוריה זהה ביעד, מוחקים את הכפולה במקור במקום להעביר אותה (409).
    const subcats = await db.collection("subcategories").find({ workspaceId: fromWs._id }).toArray();
    let movedSubcats = 0;
    let mergedSubcats = 0;
    for (const sub of subcats) {
      const duplicate = await db
        .collection("subcategories")
        .findOne({ workspaceId: toWs._id, category: sub.category, name: sub.name });
      if (duplicate) {
        await db.collection("subcategories").deleteOne({ _id: sub._id });
        mergedSubcats++;
      } else {
        await db
          .collection("subcategories")
          .updateOne({ _id: sub._id }, { $set: { workspaceId: toWs._id } });
        movedSubcats++;
      }
    }
    console.log(
      `✅ subcategories: הועברו ${movedSubcats}, מוזגו (כבר היו קיימות ביעד) ${mergedSubcats}`
    );

    console.log("\n🎉 ההעברה הושלמה בהצלחה.");
  } finally {
    await conn.close();
  }
})().catch((err) => {
  console.error("❌ ההעברה נכשלה:", err);
  process.exit(1);
});
