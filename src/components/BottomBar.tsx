"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Camera, LayoutGrid, Search } from "lucide-react";
import { CategorySheet } from "./CategorySheet";
import { Modal } from "./Modal";
import { UploadForm } from "./UploadForm";
import { MAIN_CATEGORIES, MainCategory } from "@/lib/categories";

// בר תחתון קבוע בכל מסך: כפתור "קטגוריות" (ניווט ידני), שורת כתיבה/חיפוש, והעלאת קובץ.
// מחליף את BottomNav ואת הכפתור הצף "העלה קובץ".
export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [text, setText] = useState("");

  // אם נמצאים בתוך עמוד קטגוריה, הקטגוריה בטופס ההעלאה ממולאת מראש.
  let initialCategory: MainCategory | undefined;
  if (pathname?.startsWith("/category/")) {
    const raw = decodeURIComponent(pathname.split("/category/")[1] || "");
    if ((MAIN_CATEGORIES as readonly string[]).includes(raw)) {
      initialCategory = raw as MainCategory;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setText("");
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="פתח קטגוריות"
            className="w-12 h-12 shrink-0 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
          >
            <LayoutGrid size={19} />
            <span className="text-[9px] font-bold leading-none">קטגוריות</span>
          </button>

          <form onSubmit={onSubmit} className="flex-1 min-w-0">
            <label className="flex items-center gap-2 h-12 rounded-full border border-slate-300 bg-white px-4 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="שאל, הוסף או חפש..."
                enterKeyHint="search"
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-slate-400"
              />
            </label>
          </form>

          <button
            onClick={() => setUploadOpen(true)}
            aria-label="העלאת קובץ"
            className="w-12 h-12 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-teal-700 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      <CategorySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="העלאת מסמך חדש">
        <UploadForm
          key={initialCategory}
          initialCategory={initialCategory}
          onSuccess={() => setUploadOpen(false)}
        />
      </Modal>
    </>
  );
}
