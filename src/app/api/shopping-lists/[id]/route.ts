import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import ShoppingList from "@/lib/models/ShoppingList";
import { sanitizeShoppingItems } from "@/lib/attachments";
import { overlayCreatorDisplayNames } from "@/lib/resolveDisplayNames";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();

  const list = await ShoppingList.findOne({ _id: id, workspaceId })
    .populate("createdBy", "name")
    .lean();
  if (!list) return NextResponse.json({ error: "רשימת קניות לא נמצאה" }, { status: 404 });

  const [withDisplayName] = await overlayCreatorDisplayNames(workspaceId, [list]);
  return NextResponse.json(withDisplayName);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  await connectToDatabase();

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
  }
  if ("items" in body) {
    const items = await sanitizeShoppingItems(body.items, workspaceId);
    update.items = items;
    // "הושלם" = יש לפחות פריט אחד וכולם סומנו כנוספו לעגלה
    update.isCompleted = items.length > 0 && items.every((it) => it.inCart);
  }

  const list = await ShoppingList.findOneAndUpdate({ _id: id, workspaceId }, update, {
    new: true,
  });
  if (!list) return NextResponse.json({ error: "רשימת קניות לא נמצאה" }, { status: 404 });

  return NextResponse.json(list);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await ShoppingList.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
