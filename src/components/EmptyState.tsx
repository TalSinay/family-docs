"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

// מצב ריק ידידותי: איור, כותרת, הסבר וכפתור פעולה (קישור או פתיחת חלון העלאת מסמך).
export function EmptyState({
  title,
  text,
  actionLabel,
  actionHref,
  actionUpload,
}: {
  title: string;
  text?: string;
  actionLabel?: string;
  actionHref?: string;
  actionUpload?: boolean;
}) {
  const btn =
    "inline-flex items-center gap-1.5 rounded-full bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 text-sm font-bold transition-colors";
  return (
    <div className="text-center py-10 px-4">
      <svg width="120" height="96" viewBox="0 0 120 96" className="mx-auto" aria-hidden="true">
        <rect x="14" y="30" width="92" height="56" rx="10" fill="#e0e7ff" />
        <path d="M14 40a10 10 0 0 1 10-10h24l8 10h40a10 10 0 0 1 10 10" fill="#c7d2fe" />
        <circle cx="92" cy="22" r="5" fill="#fbbf24" />
        <circle cx="26" cy="16" r="3" fill="#a78bfa" />
        <path d="M60 52v20M50 62h20" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <p className="font-bold text-lg mt-3">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1">{text}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`${btn} mt-4`}>
          <Plus size={16} /> {actionLabel}
        </Link>
      )}
      {actionLabel && actionUpload && (
        <button onClick={() => window.dispatchEvent(new Event("open-upload"))} className={`${btn} mt-4`}>
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
