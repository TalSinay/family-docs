import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// עזר לכל route שעובד על מידע פר-workspace (מסמכים, אירועים, משימות וכו').
// מחזיר את ה-workspace הפעיל של המשתמש המחובר, לצורך סינון/תיוג רשומות.
export async function requireWorkspace() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      workspaceId: null as string | null,
      error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }),
    };
  }

  const workspaceId = session.user.activeWorkspaceId;
  if (!workspaceId) {
    return {
      session,
      workspaceId: null as string | null,
      error: NextResponse.json({ error: "המשתמש אינו משויך ל-workspace" }, { status: 403 }),
    };
  }

  return { session, workspaceId, error: null as null };
}
