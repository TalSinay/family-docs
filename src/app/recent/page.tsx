import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { DocumentCard } from "@/components/DocumentCard";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";

export const dynamic = "force-dynamic";

export default async function RecentPage() {
  const session = await auth();
  const workspaceId = session?.user?.activeWorkspaceId;
  if (!session?.user || !workspaceId) redirect("/login");

  await connectToDatabase();

  const [recentlyOpenedRaw, recentlyUploadedRaw] = await Promise.all([
    DocumentModel.find({ workspaceId })
      .sort({ lastOpenedAt: -1 })
      .limit(10)
      .populate("uploadedBy", "name")
      .lean(),
    DocumentModel.find({ workspaceId })
      .sort({ uploadedAt: -1 })
      .limit(10)
      .populate("uploadedBy", "name")
      .lean(),
  ]);
  const [recentlyOpened, recentlyUploaded] = await Promise.all([
    overlayUploaderDisplayNames(workspaceId, recentlyOpenedRaw),
    overlayUploaderDisplayNames(workspaceId, recentlyUploadedRaw),
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
