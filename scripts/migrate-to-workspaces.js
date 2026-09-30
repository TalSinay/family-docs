// סקריפט הגירה חד-פעמי: מעביר אפליקציה קיימת (ללא workspace-ים) למבנה multi-tenant.
// - יוצר workspace ראשון (ברירת מחדל: "המשפחה", אפשר לשנות עם --name)
// - משייך את כל המשתמשים הקיימים ל-workspace הזה (WorkspaceMembership)
// - מתייג את כל המסמכים/אירועי היומן/המשימות/תתי-הקטגוריות הקיימים ב-workspaceId שלו
// - מסמן משתמש מסוים כ-admin, לפי --admin-email
//
// הרצה (טוען אוטומטית את MONGODB_URI מתוך .env.local):
//   node scripts/migrate-to-workspaces.js --admin-email=you@example.com [--name="המשפחה"]
//
// בטוח להרצה כמה פעמים - לא נוגע ברשומות שכבר יש להן workspaceId, ולא יוצר workspace
// כפול אם אחד כבר קיים.

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
const workspaceName = args.name || "המשפחה";
const adminEmail = args["admin-email"];

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
    // 1. workspace ראשון - לא יוצר כפול אם כבר קיים workspace בשם הזה
    let workspace = await db.collection("workspaces").findOne({ name: workspaceName });
    if (!workspace) {
      const result = await db
        .collection("workspaces")
        .insertOne({ name: workspaceName, createdAt: new Date() });
      workspace = { _id: result.insertedId, name: workspaceName };
      console.log(`✅ נוצר workspace חדש: "${workspaceName}" (${workspace._id})`);
    } else {
      console.log(`ℹ️  נמצא workspace קיים: "${workspaceName}" (${workspace._id}) - משתמש בו`);
    }
    const workspaceId = workspace._id;

    // 2. שיוך כל המשתמשים הקיימים ל-workspace (אם עדיין לא משויכים)
    const users = await db.collection("users").find().toArray();
    let memberCreated = 0;
    for (const user of users) {
      const existing = await db
        .collection("workspacememberships")
        .findOne({ workspaceId, userId: user._id });
      if (!existing) {
        await db.collection("workspacememberships").insertOne({
          workspaceId,
          userId: user._id,
          createdAt: new Date(),
        });
        memberCreated++;
      }
    }
    console.log(`✅ שויכו ${memberCreated} משתמשים חדשים ל-workspace (מתוך ${users.length} סה"כ)`);

    // 3. תיוג רשומות קיימות שעדיין אין להן workspaceId
    const collectionsToTag = ["documents", "calendarevents", "tasks", "subcategories"];
    for (const collName of collectionsToTag) {
      const result = await db
        .collection(collName)
        .updateMany({ workspaceId: { $exists: false } }, { $set: { workspaceId } });
      console.log(`✅ ${collName}: תויגו ${result.modifiedCount} רשומות`);
    }

    // 4. סימון admin
    if (adminEmail) {
      const normalizedEmail = adminEmail.toLowerCase().trim();
      const result = await db
        .collection("users")
        .updateOne({ email: normalizedEmail }, { $set: { role: "admin" } });
      if (result.matchedCount === 0) {
        console.warn(`⚠️  לא נמצא משתמש עם האימייל ${normalizedEmail} - לא סומן admin`);
      } else {
        console.log(`✅ המשתמש ${normalizedEmail} סומן כ-admin`);
      }
    } else {
      console.log("ℹ️  לא סופק --admin-email - אף משתמש לא סומן כ-admin. אפשר להריץ שוב עם הפרמטר.");
    }

    // 5. ודא ש-role="member" קיים לכל שאר המשתמשים (ברירת המחדל בסכמה, ליתר ביטחון גם כאן)
    await db.collection("users").updateMany({ role: { $exists: false } }, { $set: { role: "member" } });

    console.log("\n🎉 ההגירה הושלמה בהצלחה.");
  } finally {
    await conn.close();
  }
})().catch((err) => {
  console.error("❌ ההגירה נכשלה:", err);
  process.exit(1);
});
