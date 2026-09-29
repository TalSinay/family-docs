import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await connectToDatabase();

  const [recentlyOpened, recentlyUploaded] = await Promise.all([
    DocumentModel.find().sort({ lastOpenedAt: -1 }).limit(10).populate("uploadedBy", "name").lean(),
    DocumentModel.find().sort({ uploadedAt: -1 }).limit(10).populate("uploadedBy", "name").lean(),
  ]);

  return NextResponse.json({ recentlyOpened, recentlyUploaded });
}
