import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import Task from "@/lib/models/Task";
import CalendarEvent from "@/lib/models/CalendarEvent";
import ShoppingList, { IShoppingItem } from "@/lib/models/ShoppingList";

const RESULT_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

// בורחים מתווים מיוחדים של regex כדי שחיפוש כמו "מה סכום?" לא יקרוס/יתנהג
// בצורה לא צפויה - המשתמש מתכוון לטקסט מילולי, לא לביטוי רגולרי.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// חיפוש גלובלי בתוך ה-workspace הפעיל בלבד - על פני מסמכים, משימות, אירועי
// יומן, ורשימות קניות (לפי שם מוצר). חיפוש טקסט חלקי, לא-רגיש לאותיות גדולות/קטנות,
// עם $regex ולא עם text index של Mongo - בעברית regex נותן תוצאות עקביות יותר.
export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ documents: [], tasks: [], calendarEvents: [], shoppingLists: [] });
  }

  await connectToDatabase();

  const re = new RegExp(escapeRegex(q), "i");

  const [documents, tasks, calendarEvents, shoppingLists] = await Promise.all([
    DocumentModel.find({
      workspaceId,
      $or: [
        { title: re },
        { notes: re },
        { subcategory: re },
        { "customFields.key": re },
        { "customFields.value": re },
      ],
    })
      .select("title category subcategory isImportant amount uploadedAt")
      .sort({ uploadedAt: -1 })
      .limit(RESULT_LIMIT)
      .lean(),

    Task.find({ workspaceId, title: re })
      .select("title dueDate isDone color")
      .limit(RESULT_LIMIT)
      .lean(),

    CalendarEvent.find({ workspaceId, $or: [{ title: re }, { notes: re }] })
      .select("title date color")
      .limit(RESULT_LIMIT)
      .lean(),

    ShoppingList.find({ workspaceId, "items.name": re })
      .select("title items isCompleted")
      .limit(RESULT_LIMIT)
      .lean(),
  ]);

  // ברשימות קניות, מצמצמים את items לאלה שבאמת תאמו (כדי לא לשלוח ללקוח
  // את כל הרשימה, ולהציג "נמצא: X" ברור)
  const shoppingListsWithMatches = shoppingLists.map((list) => ({
    _id: list._id,
    title: list.title,
    isCompleted: list.isCompleted,
    matchingItems: list.items
      .filter((it: IShoppingItem) => re.test(it.name))
      .map((it: IShoppingItem) => it.name),
  }));

  return NextResponse.json({
    documents,
    tasks,
    calendarEvents,
    shoppingLists: shoppingListsWithMatches,
  });
}
