import mongoose, { Schema, models, model } from "mongoose";
import { MAIN_CATEGORIES } from "@/lib/categories";
import "@/lib/models/Workspace";

// תתי-קטגוריות שנוספו דינמית ע"י המשתמשים (בנוסף לברירות המחדל ב-lib/categories.ts),
// פר workspace.
export interface ISubCategory {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  category: (typeof MAIN_CATEGORIES)[number];
  name: string;
}

const SubCategorySchema = new Schema<ISubCategory>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  category: { type: String, required: true, enum: MAIN_CATEGORIES },
  name: { type: String, required: true },
});

SubCategorySchema.index({ workspaceId: 1, category: 1, name: 1 }, { unique: true });

export default models.SubCategory || model<ISubCategory>("SubCategory", SubCategorySchema);
