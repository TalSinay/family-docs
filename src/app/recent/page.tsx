import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { DocumentCard } from "@/components/DocumentCard";

export const dynamic = "force-dynamic";

export default async function RecentPage() {
  await connectToDatabase();

  const [recentlyOpened, recentlyUploaded] = await Promise.all([
    DocumentModel.find().sort({ lastOpenedAt: -1 }).limit(10).populate("uploadedBy", "name").lean(),
    DocumentModel.find().sort({ uploadedAt: -1 }).limit(10).populate("uploadedBy", "name").lean(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold mb-1">🕒 נפתחו לאחרונה</h1>
        <p className="text-sm text-slate-500 mb-3">10 המסמכים שנצפו לאחרונה</p>
        <div className="space-y-2">
          {recentlyOpened.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">עדיין לא נפתחו מסמכים.</p>
          )}
          {JSON.parse(JSON.stringify(recentlyOpened)).map((doc: { _id: string; [key: string]: unknown }) => (
            <DocumentCard key={doc._id} doc={doc as never} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-1">⬆️ הועלו לאחרונה</h2>
        <p className="text-sm text-slate-500 mb-3">10 המסמכים האחרונים שנוספו</p>
        <div className="space-y-2">
          {recentlyUploaded.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">עדיין לא הועלו מסמכים.</p>
          )}
          {JSON.parse(JSON.stringify(recentlyUploaded)).map((doc: { _id: string; [key: string]: unknown }) => (
            <DocumentCard key={doc._id} doc={doc as never} />
          ))}
        </div>
      </div>
    </div>
  );
}
