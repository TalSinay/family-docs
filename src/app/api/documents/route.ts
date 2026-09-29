import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import SubCategory from "@/lib/models/SubCategory";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const important = searchParams.get("important");
  const sortBy = searchParams.get("sortBy") || "uploadedAt";
  const limit = Number(searchParams.get("limit") || 100);
  const dueFrom = searchParams.get("dueFrom"); // "YYYY-MM-DD"
  const dueTo = searchParams.get("dueTo"); // "YYYY-MM-DD"

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (important === "true") filter.isImportant = true;
  if (dueFrom && dueTo) filter.dueDate = { $gte: dueFrom, $lte: dueTo };

  const docs = await DocumentModel.find(filter)
    .sort({ [sortBy]: -1 })
    .limit(limit)
    .populate("uploadedBy", "name email")
    .lean();

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

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
    fileId,
    fileName,
    fileMimeType,
    fileSize,
  } = body;

  if (!title || !category) {
    return NextResponse.json({ error: "חסרים שדות חובה: כותרת וקטגוריה" }, { status: 400 });
  }

  await connectToDatabase();

  // אם תת-הקטגוריה חדשה - שומרים אותה לרשימה כדי שתופיע גם בעתיד
  if (subcategory) {
    await SubCategory.updateOne(
      { category, name: subcategory },
      { $setOnInsert: { category, name: subcategory } },
      { upsert: true }
    );
  }

  const doc = await DocumentModel.create({
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
    fileId: fileId || undefined,
    fileName: fileName || undefined,
    fileMimeType: fileMimeType || undefined,
    fileSize: fileSize || undefined,
    uploadedBy: (session.user as { id: string }).id,
  });

  return NextResponse.json(doc, { status: 201 });
}
