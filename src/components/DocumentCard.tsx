"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { SwipeRow } from "./SwipeRow";
import { useToast } from "./ToastProvider";
import { categoryUi } from "@/lib/categoryTheme";
import { DueRing } from "./DueRing";
import { formatDate } from "@/lib/format";

type DocCardData = {
  _id: string;
  title: string;
  category: string;
  subcategory?: string;
  isImportant?: boolean;
  amount?: number;
  dueDate?: string;
  uploadedAt: string | Date;
  uploadedBy?: { name?: string } | null;
};

export function DocumentCard({ doc }: { doc: DocCardData }) {
  const ui = categoryUi(doc.category);
  const router = useRouter();
  const toast = useToast();
  const [important, setImportant] = useState(!!doc.isImportant);
  const [removed, setRemoved] = useState(false);

  async function toggleImportant() {
    const next = !important;
    setImportant(next);
    const res = await fetch(`/api/documents/${doc._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isImportant: next }),
    });
    if (!res.ok) setImportant(!next);
    else toast.show({ title: next ? "סומן כחשוב" : "הוסר מחשובים", detail: doc.title });
  }

  async function remove() {
    // מחיקת מסמך (כולל הקובץ) אינה הפיכה, לכן מבקשים אישור
    if (!window.confirm(`למחוק את "${doc.title}"?`)) return;
    setRemoved(true);
    const res = await fetch(`/api/documents/${doc._id}`, { method: "DELETE" });
    if (!res.ok) setRemoved(false);
    else router.refresh();
  }

  if (removed) return null;
  return (
    <SwipeRow
      right={{ label: important ? "הסר חשוב" : "חשוב", color: "#f59e0b", icon: <Star size={18} />, run: toggleImportant }}
      left={{ label: "מחיקה", color: "#dc2626", icon: <Trash2 size={18} />, run: remove }}
    >
    <Link
      href={`/documents/${doc._id}`}
      className="card flex items-center gap-3 p-4 hover:border-teal-300 transition-colors"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: ui.soft, color: ui.color }}
      >
        <ui.Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium truncate">{doc.title}</p>
          {important && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
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
      <DueRing dueDate={doc.dueDate} />
    </Link>
    </SwipeRow>
  );
}
