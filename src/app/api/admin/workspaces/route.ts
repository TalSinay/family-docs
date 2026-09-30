import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Workspace from "@/lib/models/Workspace";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectToDatabase();
  const workspaces = await Workspace.find().sort({ createdAt: 1 }).lean();
  const counts = await WorkspaceMembership.aggregate([
    { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return NextResponse.json(
    workspaces.map((w) => ({ ...w, memberCount: countMap.get(w._id.toString()) || 0 }))
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { name } = await req.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "חסר שם ל-workspace" }, { status: 400 });
  }

  await connectToDatabase();
  const workspace = await Workspace.create({ name: String(name).trim() });
  return NextResponse.json(workspace, { status: 201 });
}
