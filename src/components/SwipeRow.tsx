"use client";

import { ReactNode, useRef, useState } from "react";

export type SwipeAction = { label: string; color: string; icon: ReactNode; run: () => void };

const THRESHOLD = 88; // כמה צריך למשוך כדי להפעיל
const MAX = 120;

// שורה שאפשר להחליק: משיכה ימינה מפעילה את `right`, משיכה שמאלה את `left`.
// הפעולה מופעלת כשעוברים את הסף ומשחררים; אחרת השורה חוזרת למקומה.
// touch-action: pan-y משאיר גלילה אנכית רגילה. בעכבר/מקלדת הכפתורים הרגילים בשורה ממשיכים לעבוד.
export function SwipeRow({
  children,
  left,
  right,
}: {
  children: ReactNode;
  left?: SwipeAction;
  right?: SwipeAction;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const moved = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, locked: null };
    moved.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (s.locked === null) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      s.locked = Math.abs(ddx) > Math.abs(ddy) * 1.4; // אופקי בלבד
      if (s.locked) {
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (!s.locked) return;
    moved.current = true;
    let v = ddx;
    if (v > 0 && !right) v = 0;
    if (v < 0 && !left) v = 0;
    setDx(Math.max(-MAX, Math.min(MAX, v)));
  }

  function end() {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s?.locked) return;
    const v = dx;
    setDx(0);
    if (v >= THRESHOLD && right) right.run();
    else if (v <= -THRESHOLD && left) left.run();
  }

  // אחרי גרירה לא רוצים שהשחרור יפתח את הקישור שבשורה
  function onClickCapture(e: React.MouseEvent) {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }

  const active = dx > 0 ? right : dx < 0 ? left : undefined;
  const ready = Math.abs(dx) >= THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {active && (
        <div
          className="absolute inset-0 flex items-center px-5 text-white font-bold text-sm gap-2"
          style={{
            backgroundColor: active.color,
            justifyContent: dx > 0 ? "flex-start" : "flex-end",
            opacity: ready ? 1 : 0.8,
          }}
          aria-hidden="true"
        >
          {active.icon}
          <span>{active.label}</span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onClickCapture={onClickCapture}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
