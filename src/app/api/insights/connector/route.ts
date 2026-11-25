import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import McpToken from "@/lib/models/McpToken";

// ניהול הטוקן של שרת ה-MCP (חיבור Claude לאפליקציה). הטוקן מוצג פעם אחת בלבד, בעת היצירה.
export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const t = await McpToken.findOne({ workspaceId }).select("createdAt lastUsedAt").lean();
  return NextResponse.json({
    active: !!t,
    createdAt: t ? new Date(t.createdAt).toISOString() : null,
    lastUsedAt: t?.lastUsedAt ? new Date(t.lastUsedAt).toISOString() : null,
  });
}

// יוצר טוקן חדש (ומחליף קיים) ומחזיר את כתובת החיבור המלאה
export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await McpToken.findOneAndUpdate(
    { workspaceId },
    { workspaceId, tokenHash, createdBy: session!.user.id, createdAt: new Date(), $unset: { lastUsedAt: 1 } },
    { upsert: true }
  );
  const origin = new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}/api/mcp/${token}` });
}

export async function DELETE() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  await McpToken.deleteOne({ workspaceId });
  return NextResponse.json({ ok: true });
}
