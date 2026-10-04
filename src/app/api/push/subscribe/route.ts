import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import PushSubscription from "@/lib/models/PushSubscription";

// שומר/מעדכן מינוי Web Push של המכשיר הנוכחי - הגוף הוא ה-JSON הגולמי
// שמוחזר מ-PushSubscription.toJSON() בדפדפן ({ endpoint, keys: {p256dh, auth} }).
export async function POST(req: NextRequest) {
  const { session, error } = await requireWorkspace();
  if (error) return error;

  const body = await req.json();
  const { endpoint, keys } = body || {};
  if (
    typeof endpoint !== "string" ||
    !endpoint ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string"
  ) {
    return NextResponse.json({ error: "מינוי לא תקין" }, { status: 400 });
  }

  await connectToDatabase();

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userId: session!.user.id },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true });
}

// מבטל מינוי (כשהמשתמש מכבה התראות במכשיר הזה)
export async function DELETE(req: NextRequest) {
  const { error } = await requireWorkspace();
  if (error) return error;

  const { endpoint } = await req.json();
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ error: "חסר endpoint" }, { status: 400 });
  }

  await connectToDatabase();
  await PushSubscription.deleteOne({ endpoint });

  return NextResponse.json({ ok: true });
}
