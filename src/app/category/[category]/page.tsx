import Link from "next/link";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import SubCategoryModel from "@/lib/models/SubCategory";
import { DocumentCard } from "@/components/DocumentCard";
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

  await connectToDatabase();

  const [customSubs, docs] = await Promise.all([
    SubCategoryModel.find({ category }).lean(),
    DocumentModel.find({ category, ...(sub ? { subcategory: sub } : {}) })
      .sort({ uploadedAt: -1 })
      .populate("uploadedBy", "name")
      .lean(),
  ]);

  const subcategories = Array.from(
    new Set([...DEFAULT_SUBCATEGORIES[category], ...customSubs.map((c) => c.name)])
  );

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

      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">אין עדיין מסמכים בקטגוריה הזו.</p>
        )}
        {JSON.parse(JSON.stringify(docs)).map((doc: { _id: string; [key: string]: unknown }) => (
          <DocumentCard key={doc._id} doc={doc as never} />
        ))}
      </div>
    </div>
  );
}
