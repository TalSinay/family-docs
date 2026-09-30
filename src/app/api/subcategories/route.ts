import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import SubCategory from "@/lib/models/SubCategory";
import { DEFAULT_SUBCATEGORIES, MAIN_CATEGORIES, MainCategory } from "@/lib/categories";

export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  await connectToDatabase();
  const custom = await SubCategory.find({ workspaceId }).lean();

  const result: Record<MainCategory, string[]> = {} as Record<MainCategory, string[]>;
  for (const cat of MAIN_CATEGORIES) {
    const defaults = DEFAULT_SUBCATEGORIES[cat];
    const added = custom.filter((c) => c.category === cat).map((c) => c.name);
    result[cat] = Array.from(new Set([...defaults, ...added]));
  }

  return NextResponse.json(result);
}
