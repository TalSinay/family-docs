import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import SubCategoryModel from "@/lib/models/SubCategory";
import Workspace from "@/lib/models/Workspace";
import { DocumentCard } from "@/components/DocumentCard";
import { FinanceOverview, FinanceDoc } from "@/components/FinanceOverview";
import { DEFAULT_SUBCATEGORIES, MAIN_CATEGORIES, MainCategory } from "@/lib/categories";
import clsx from "clsx";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory) as MainCategory;
  const { sub } = await searchParams;

  if (!(MAIN_CATEGORIES as readonly string[]).includes(category)) {
    notFound();
  }

  const session = await auth();
  const workspaceId = session?.user?.activeWorkspaceId;
  if (!session?.user || !workspaceId) redirect("/login");

  await connectToDatabase();

  const [customSubs, docs, workspace] = await Promise.all([
    SubCategoryModel.find({ category, workspaceId }).lean(),
    DocumentModel.find({
      workspaceId,
      category,
      // בפיננסים הסיכום (סה"כ/עוגה) תמיד על כל הרשומות; הסינון חל על הרשימה בלבד
      ...(sub && category !== "פיננסים" ? { subcategory: sub } : {}),
    })
      .sort({ uploadedAt: -1 })
      .populate("uploadedBy", "name")
      .lean(),
    Workspace.findById(workspaceId).select("generalLabels").lean(),
  ]);

  // בקטגוריית "כללי" ניתן להתאים אישית פר-workspace את תתי-הקטגוריות המוצעות
  // (לדוגמה שמות בני המשפחה) - אם הוגדרו, משתמשים בהן במקום ברירת המחדל
  // הגלובלית, בדיוק כמו ב-/api/subcategories.
  const defaults =
    category === "כללי" && workspace?.generalLabels?.length
      ? workspace.generalLabels
      : DEFAULT_SUBCATEGORIES[category];
  const subcategories = Array.from(new Set([...defaults, ...customSubs.map((c) => c.name)]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{category}</h1>

      {subcategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Link
            href={`/category/${encodeURIComponent(category)}`}
            className={clsx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border",
              !sub ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-slate-300"
            )}
          >
            הכל
          </Link>
          {subcategories.map((s) => (
            <Link
              key={s}
              href={`/category/${encodeURIComponent(category)}?sub=${encodeURIComponent(s)}`}
              className={clsx(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border",
                sub === s ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-slate-300"
              )}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {category === "פיננסים" ? (
        <FinanceOverview
          key={docs.map((d) => `${d._id}:${d.amount ?? ""}`).join(",")}
          initialDocs={JSON.parse(JSON.stringify(docs)) as FinanceDoc[]}
          sub={sub}
        />
      ) : (
      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">אין עדיין מסמכים בקטגוריה הזו.</p>
        )}
        {JSON.parse(JSON.stringify(docs)).map((doc: { _id: string; [key: string]: unknown }) => (
          <DocumentCard key={doc._id} doc={doc as never} />
        ))}
      </div>
      )}
    </div>
  );
}
