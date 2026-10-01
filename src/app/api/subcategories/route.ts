import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import SubCategory from "@/lib/models/SubCategory";
import Workspace from "@/lib/models/Workspace";
import { DEFAULT_SUBCATEGORIES, MAIN_CATEGORIES, MainCategory } from "@/lib/categories";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();
  const [custom, workspace] = await Promise.all([
    SubCategory.find({ workspaceId }).lean(),
    Workspace.findById(workspaceId).select("generalLabels").lean(),
  ]);

  const result: Record<MainCategory, string[]> = {} as Record<MainCategory, string[]>;
  for (const cat of MAIN_CATEGORIES) {
    // תתי-הקטגוריות המוצעות ב"כללי" ניתנות להתאמה אישית פר-workspace (לדוגמה
    // שמות בני המשפחה) - משתמשים בהן במקום ברירת המחדל הגלובלית אם הוגדרו.
    const defaults =
      cat === "כללי" && workspace?.generalLabels?.length
        ? workspace.generalLabels
        : DEFAULT_SUBCATEGORIES[cat];
    const added = custom.filter((c) => c.category === cat).map((c) => c.name);
    result[cat] = Array.from(new Set([...defaults, ...added]));
  }

  return NextResponse.json(result);
}
