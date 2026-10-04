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

// שולח התראת push לכל המכשירים הרשומים של משתמשים נתונים (userIds). מתעלם
// בשקט אם VAPID לא מוגדר (האפליקציה עדיין עובדת כרגיל בלי push) או אם אין
// מינויים. מינוי שכבר לא תקף (המשתמש ביטל הרשאה/מחק את האפליקציה) נמחק.
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureVapidConfigured() || userIds.length === 0) return;

  const subs = await PushSubscriptionModel.find({ userId: { $in: userIds } }).lean();
  if (subs.length === 0) return;

  const payloadStr = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payloadStr
        );
      } catch (err: unknown) {
        // 404/410 = המינוי לא תקף יותר (בוטל/נמחק בצד הדפדפן) - מנקים אותו
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}
