import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Workspace from "@/lib/models/Workspace";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";
import User from "@/lib/models/User";
import DocumentModel from "@/lib/models/Document";
import FileModel from "@/lib/models/File";
import CalendarEvent from "@/lib/models/CalendarEvent";
import Task from "@/lib/models/Task";
import SubCategory from "@/lib/models/SubCategory";
import ShoppingList from "@/lib/models/ShoppingList";
import MonthlyReminder from "@/lib/models/MonthlyReminder";

// גיבוי מלא של כל הנתונים (כל ה-workspace-ים, לא רק הפעיל) כקובץ ZIP אחד -
// זמין רק ל-admin מאומת (ראו requireAdmin, שכולל את חלון 48 השעות מאז OTP).
// כל collection נשמר כ-JSON קריא, והקבצים הבינאריים (מסמכים/תמונות) נשמרים
// כקבצים נפרדים בתיקיית files/ בתוך ה-ZIP, בשמם המקורי.
//
// הערה: רץ כ-function אחת בלי streaming - לכמות נתונים גדולה מאוד (קרוב
// למגבלת ה-512MB של Atlas Free) זה עלול לפגוע ב-timeout של Vercel (לרוב
// 10 שניות בטיר החינמי). לכמות נתונים משפחתית רגילה זה אמור לעבוד בנוחות.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectToDatabase();

  const [
    workspaces,
    memberships,
    users,
    documents,
    fileDocs,
    calendarEvents,
    tasks,
    subcategories,
    shoppingLists,
    monthlyReminders,
  ] = await Promise.all([
    Workspace.find({}).lean(),
    WorkspaceMembership.find({}).lean(),
    // בכוונה בלי passwordHash/otp*/reset* - גיבוי הנתונים, לא סיסמאות
    User.find({}).select("email name role createdAt").lean(),
    DocumentModel.find({}).lean(),
    FileModel.find({}).select("filename mimeType size createdAt data").lean(),
    CalendarEvent.find({}).lean(),
    Task.find({}).lean(),
    SubCategory.find({}).lean(),
    ShoppingList.find({}).lean(),
    MonthlyReminder.find({}).lean(),
  ]);

  const zip = new JSZip();
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(
    new Date()
  );

  zip.file("workspaces.json", JSON.stringify(workspaces, null, 2));
  zip.file("workspace-memberships.json", JSON.stringify(memberships, null, 2));
  zip.file("users.json", JSON.stringify(users, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));
  zip.file("calendar-events.json", JSON.stringify(calendarEvents, null, 2));
  zip.file("tasks.json", JSON.stringify(tasks, null, 2));
  zip.file("subcategories.json", JSON.stringify(subcategories, null, 2));
  zip.file("shopping-lists.json", JSON.stringify(shoppingLists, null, 2));
  zip.file("monthly-reminders.json", JSON.stringify(monthlyReminders, null, 2));

  // קבצים בינאריים - נשמרים בנפרד מה-JSON (files.json רק המטא-דאטה, בלי
  // ה-data עצמו), כדי שאפשר יהיה לפתוח כל קובץ ישירות מהתיקייה בלי לפענח base64.
  zip.file(
    "files.json",
    JSON.stringify(
      fileDocs.map((f) => ({
        _id: f._id,
        filename: f.filename,
        mimeType: f.mimeType,
        size: f.size,
        createdAt: f.createdAt,
      })),
      null,
      2
    )
  );
  const filesFolder = zip.folder("files");
  for (const f of fileDocs) {
    // _id בתחילת השם מונע התנגשות בין קבצים עם אותו שם מקור
    filesFolder?.file(`${f._id.toString()}-${f.filename}`, f.data as Buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="family-docs-backup-${dateStr}.zip"`,
    },
  });
}
