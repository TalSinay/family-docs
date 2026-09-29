import Link from "next/link";
import { Star, FileText } from "lucide-react";
import { formatDate } from "@/lib/format";

type DocCardData = {
  _id: string;
  title: string;
  category: string;
  subcategory?: string;
  isImportant?: boolean;
  amount?: number;
  uploadedAt: string | Date;
  uploadedBy?: { name?: string } | null;
};

export function DocumentCard({ doc }: { doc: DocCardData }) {
  return (
    <Link
      href={`/documents/${doc._id}`}
      className="card flex items-center gap-3 p-4 hover:border-teal-300 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
        <FileText size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium truncate">{doc.title}</p>
          {doc.isImportant && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {doc.subcategory ? `${doc.category} · ${doc.subcategory}` : doc.category}
          {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ""} · {formatDate(doc.uploadedAt)}
        </p>
      </div>
      {typeof doc.amount === "number" && (
        <span className="text-sm font-semibold text-slate-700 shrink-0">
          {new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(doc.amount)}
        </span>
      )}
    </Link>
  );
}
