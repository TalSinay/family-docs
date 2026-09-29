import { notFound } from "next/navigation";
import mongoose from "mongoose";
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

  await connectToDatabase();

  // צפייה בעמוד = עדכון lastOpenedAt (לצורך "נפתחו לאחרונה")
  const doc = await DocumentModel.findByIdAndUpdate(
    id,
    { lastOpenedAt: new Date() },
    { new: true }
  )
    .populate("uploadedBy", "name email")
    .lean();

  if (!doc) notFound();

  return <DocumentDetail doc={JSON.parse(JSON.stringify(doc))} />;
}
