"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // מוצג ב-portal על ה-body: כך הוא תמיד ביחס לחלון, גם אם נפתח מתוך רכיב עם position/stacking משלו
  // (למשל מתוך הבר התחתון), ולא גולש מחוץ למסך.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white rounded-t-3xl sm:rounded-3xl shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-3xl">
          <h2 className="text-lg font-bold min-w-0 truncate">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 min-w-0">{children}</div>
      </div>
    </div>,
    document.body
  );
}
