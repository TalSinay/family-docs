import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { DocumentCard } from "@/components/DocumentCard";

export const dynamic = "force-dynamic";

export default async function ImportantPage() {
  await connectToDatabase();
  const docs = await DocumentModel.find({ isImportant: true })
    .sort({ uploadedAt: -1 })
    .populate("uploadedBy", "name")
    .lean();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">⭐ מסמכים חשובים</h1>
      <p className="text-sm text-slate-500">
        כל המסמכים שסומנו כחשובים, מכל הקטגוריות
      </p>
      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            עדיין לא סימנת מסמכים כחשובים. אפשר לסמן מתוך עמוד המסמך עצמו.
          </p>
        )}
        {JSON.parse(JSON.stringify(docs)).map((doc: { _id: string; [key: string]: unknown }) => (
          <DocumentCard key={doc._id} doc={doc as never} />
        ))}
      </div>
    </div>
  );
}
