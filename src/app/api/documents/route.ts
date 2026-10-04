import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import SubCategory from "@/lib/models/SubCategory";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";
import { sanitizeAttachments } from "@/lib/attachments";

export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const important = searchParams.get("important");
  const sortBy = searchParams.get("sortBy") || "uploadedAt";
  const limit = Number(searchParams.get("limit") || 100);
  const dueFrom = searchParams.get("dueFrom"); // "YYYY-MM-DD"
  const dueTo = searchParams.get("dueTo"); // "YYYY-MM-DD"

  const filter: Record<string, unknown> = { workspaceId };
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (important === "true") filter.isImportant = true;
  if (dueFrom && dueTo) filter.dueDate = { $gte: dueFrom, $lte: dueTo };

  const docs = await DocumentModel.find(filter)
    .sort({ [sortBy]: -1 })
    .limit(limit)
    .populate("uploadedBy", "name email")
    .lean();

  return NextResponse.json(await overlayUploaderDisplayNames(workspaceId, docs));
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const body = await req.json();
  const {
    title,
    category,
    subcategory,
    notes,
    externalLink,
    customFields,
    dueDate,
    dueDateTitle,
    amount,
    isMonthlyPayment,
    monthlyAmount,
    attachments,
  } = body;

  if (!title || !category) {
    return NextResponse.json({ error: "חסרים שדות חובה: כותרת וקטגוריה" }, { status: 400 });
  }

  await connectToDatabase();

  // מסננים לרשומות attachments תקינות בלבד שהועלו בפועל ב-workspace הפעיל
  const validAttachments = await sanitizeAttachments(attachments, workspaceId);

  // אם תת-הקטגוריה חדשה - שומרים אותה לרשימה כדי שתופיע גם בעתיד
  if (subcategory) {
    await SubCategory.updateOne(
      { workspaceId, category, name: subcategory },
      { $setOnInsert: { workspaceId, category, name: subcategory } },
      { upsert: true }
    );
  }

  const doc = await DocumentModel.create({
    workspaceId,
    title,
    category,
    subcategory: subcategory || undefined,
    notes: notes || undefined,
    externalLink: externalLink || undefined,
    customFields: customFields || [],
    dueDate: dueDate || undefined,
    dueDateTitle: dueDateTitle || undefined,
    amount: amount ?? undefined,
    isMonthlyPayment: !!isMonthlyPayment,
    monthlyAmount: isMonthlyPayment ? monthlyAmount : undefined,
    attachments: validAttachments,
    uploadedBy: session!.user.id,
  });

  return NextResponse.json(doc, { status: 201 });
}
