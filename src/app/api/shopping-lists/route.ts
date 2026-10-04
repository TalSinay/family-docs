import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import ShoppingList from "@/lib/models/ShoppingList";
import { overlayCreatorDisplayNames } from "@/lib/resolveDisplayNames";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();

  // רשימות פתוחות קודם (לפי תאריך יצירה, מהחדש לישן), ואז רשימות שהושלמו
  const lists = await ShoppingList.find({ workspaceId })
    .sort({ isCompleted: 1, createdAt: -1 })
    .populate("createdBy", "name")
    .lean();

  return NextResponse.json(await overlayCreatorDisplayNames(workspaceId, lists));
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { title } = await req.json();

  await connectToDatabase();

  const defaultTitle = `קניות - ${new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
  }).format(new Date())}`;

  const list = await ShoppingList.create({
    workspaceId,
    title: (title && String(title).trim()) || defaultTitle,
    items: [],
    isCompleted: false,
    createdBy: session!.user.id,
  });

  return NextResponse.json(list, { status: 201 });
}
