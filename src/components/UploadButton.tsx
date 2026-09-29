"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "./Modal";
import { UploadForm } from "./UploadForm";
import { MAIN_CATEGORIES, MainCategory } from "@/lib/categories";

// כפתור צף שזמין בכל עמוד. אם נמצאים בתוך עמוד קטגוריה ספציפית (/category/xxx),
// הקטגוריה בטופס ההעלאה תהיה ממולאת מראש בהתאם.
export function UploadButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  let initialCategory: MainCategory | undefined;
  if (pathname?.startsWith("/category/")) {
    const raw = decodeURIComponent(pathname.split("/category/")[1] || "");
    if ((MAIN_CATEGORIES as readonly string[]).includes(raw)) {
      initialCategory = raw as MainCategory;
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0 z-40 bg-teal-700 hover:bg-teal-800 text-white rounded-full shadow-lg shadow-teal-900/20 px-5 py-3.5 flex items-center gap-2 font-medium transition-transform active:scale-95"
      >
        <Plus size={20} />
        העלה קובץ
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="העלאת מסמך חדש">
        <UploadForm key={initialCategory} initialCategory={initialCategory} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
