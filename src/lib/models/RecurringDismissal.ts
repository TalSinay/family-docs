import mongoose, { Schema, models, model } from "mongoose";

// הוצאה קבועה שהמשתמש ענה עליה "לא הלוואה" - לא שואלים עליה שוב (המפתח הוא שם מנוקה, ראו lib/recurring.ts)
export interface IRecurringDismissal {
  workspaceId: mongoose.Types.ObjectId;
  key: string;
  createdAt: Date;
}

const RecurringDismissalSchema = new Schema<IRecurringDismissal>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  key: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
RecurringDismissalSchema.index({ workspaceId: 1, key: 1 }, { unique: true });

export default models.RecurringDismissal || model<IRecurringDismissal>("RecurringDismissal", RecurringDismissalSchema);
