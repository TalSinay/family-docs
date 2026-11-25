import mongoose, { Schema, models, model } from "mongoose";

// תובנה שנשמרה ע"י Claude דרך שרת ה-MCP (כלי save_insight) ומוצגת בעמוד "תובנות".
export interface IInsight {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  topic: "הוצאות" | "הכנסות" | "כללי";
  createdAt: Date;
}

const InsightSchema = new Schema<IInsight>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  topic: { type: String, enum: ["הוצאות", "הכנסות", "כללי"], default: "כללי" },
  createdAt: { type: Date, default: Date.now },
});

InsightSchema.index({ workspaceId: 1, createdAt: -1 });

export default models.Insight || model<IInsight>("Insight", InsightSchema);
