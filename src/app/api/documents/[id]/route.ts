import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  // כל צפייה במסמך מעדכנת lastOpenedAt (לצורך "מסמכים אחרונים")
  const doc = await DocumentModel.findByIdAndUpdate(
    id,
    { lastOpenedAt: new Date() },
    { new: true }
  ).populate("uploadedBy", "name email");

  if (!doc) return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "title",
    "notes",
    "externalLink",
    "isImportant",
    "customFields",
    "amount",
    "isMonthlyPayment",
    "monthlyAmount",
    "subcategory",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }

  await connectToDatabase();
  const doc = await DocumentModel.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });

  return NextResponse.json(doc);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await DocumentModel.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
