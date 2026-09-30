import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();

  const [recentlyOpened, recentlyUploaded] = await Promise.all([
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

  return NextResponse.json({
    recentlyOpened: await overlayUploaderDisplayNames(workspaceId, recentlyOpened),
    recentlyUploaded: await overlayUploaderDisplayNames(workspaceId, recentlyUploaded),
  });
}
