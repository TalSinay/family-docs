import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import Insight from "@/lib/models/Insight";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const rows = await Insight.find({ workspaceId }).sort({ createdAt: -1 }).limit(200).lean();
  return NextResponse.json(
    rows.map((r) => ({ id: String(r._id), title: r.title, body: r.body, topic: r.topic, createdAt: new Date(r.createdAt).toISOString() }))
  );
}

export async function DELETE(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: "מזהה לא תקין" }, { status: 400 });
  await connectToDatabase();
  await Insight.deleteOne({ _id: id, workspaceId });
  return NextResponse.json({ ok: true });
}
