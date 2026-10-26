"use client";

import { HEBREW_MONTHS } from "@/lib/format";

// בחירת חודש ("YYYY-MM"): 12 חודשים אחורה ו-24 קדימה, כי רוב ההוצאות/הכנסות הידניות הן עתידיות.
export function MonthPicker({
  value,
  onChange,
  className = "input",
}: {
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
  className?: string;
}) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = -12; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  // חודש שמחוץ לטווח (רשומה ישנה/רחוקה) נשאר נבחר ולא "נעלם"
  if (value && !options.some((o) => o.value === value)) {
    const [y, m] = value.split("-").map(Number);
    options.push({ value, label: `${HEBREW_MONTHS[m - 1]} ${y}` });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// מעביר תאריך "YYYY-MM-DD" לחודש אחר ("YYYY-MM"), באותו יום בחודש (מוגבל לאורך החודש החדש)
export function moveToMonth(dateStr: string, month: string): string {
  const day = Number(dateStr.slice(8, 10)) || 1;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
