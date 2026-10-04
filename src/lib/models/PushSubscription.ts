import mongoose, { Schema, models, model } from "mongoose";

// מינוי Web Push בודד (דפדפן/מכשיר אחד) של משתמש - לא פר-workspace, כי זה
// שייך למכשיר שבו המשתמש הפעיל התראות, בלי קשר לאיזה workspace פעיל עליו כרגע.
export interface IPushSubscription {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
});

PushSubscriptionSchema.index({ userId: 1 });

export default models.PushSubscription ||
  model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
