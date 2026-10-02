"use client";

import clsx from "clsx";
import { ITEM_COLORS } from "@/lib/itemColors";

// שורת עיגולי צבע לבחירה (ליצירה או עריכה של אירוע/משימה) - ראו src/lib/itemColors.ts
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="בחירת צבע">
      {ITEM_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.name}
          aria-label={c.name}
          className={clsx(
            "w-7 h-7 rounded-full shrink-0 transition-transform",
            value === c.value && "ring-2 ring-offset-2 ring-slate-400 scale-105"
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}
