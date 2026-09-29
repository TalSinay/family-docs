import mongoose, { Schema, models, model } from "mongoose";
import { MAIN_CATEGORIES } from "@/lib/categories";

// תתי-קטגוריות שנוספו דינמית ע"י המשתמשים (בנוסף לברירות המחדל ב-lib/categories.ts)
export interface ISubCategory {
  _id: mongoose.Types.ObjectId;
  category: (typeof MAIN_CATEGORIES)[number];
  name: string;
}

const SubCategorySchema = new Schema<ISubCategory>({
  category: { type: String, required: true, enum: MAIN_CATEGORIES },
  name: { type: String, required: true },
});

SubCategorySchema.index({ category: 1, name: 1 }, { unique: true });

export default models.SubCategory || model<ISubCategory>("SubCategory", SubCategorySchema);
