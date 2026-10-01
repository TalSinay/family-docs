import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { DocumentDetail } from "@/components/DocumentDetail";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) notFound();

  const session = await auth();
  const workspaceId = session?.user?.activeWorkspaceId;
  if (!session?.user || !workspaceId) redirect("/login");

  await connectToDatabase();

  // צפייה בעמוד = עדכון lastOpenedAt (לצורך "נפתחו לאחרונה") - רק אם המסמך שייך
  // ל-workspace הפעיל של המשתמש, אחרת לא נחשפת אפילו עובדת הקיום שלו.
  const doc = await DocumentModel.findOneAndUpdate(
    { _id: id, workspaceId },
    { lastOpenedAt: new Date() },
    { new: true }
  )
    .populate("uploadedBy", "name email")
    .lean();

  if (!doc) notFound();

  return <DocumentDetail doc={JSON.parse(JSON.stringify(doc))} />;
}
