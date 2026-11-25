import webpush from "web-push";
import PushSubscriptionModel from "@/lib/models/PushSubscription";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };
export type PushResult = { configured: boolean; devices: number; delivered: number; failed: number; lastError?: string };

export function isPushConfigured() {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

// שולח התראת push לכל המכשירים הרשומים של משתמשים נתונים (userIds). מתעלם
// בשקט אם VAPID לא מוגדר (האפליקציה עדיין עובדת כרגיל בלי push) או אם אין
// מינויים. מינוי שכבר לא תקף (המשתמש ביטל הרשאה/מחק את האפליקציה) נמחק.
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { configured: ensureVapidConfigured(), devices: 0, delivered: 0, failed: 0 };
  if (!result.configured || userIds.length === 0) return result;

  const subs = await PushSubscriptionModel.find({ userId: { $in: userIds } }).lean();
  result.devices = subs.length;
  if (subs.length === 0) return result;

  const payloadStr = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payloadStr
        );
        result.delivered++;
      } catch (err: unknown) {
        // 404/410 = המינוי לא תקף יותר (בוטל/נמחק בצד הדפדפן) - מנקים אותו
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
        result.failed++;
        result.lastError = `${statusCode ?? ""} ${err instanceof Error ? err.message : ""}`.trim().slice(0, 200);
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.deleteOne({ _id: sub._id });
        } else {
          console.error("push send failed", statusCode, err instanceof Error ? err.message : err);
        }
      }
    })
  );
  return result;
}
