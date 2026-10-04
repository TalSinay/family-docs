"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Image as ImageIcon,
  PartyPopper,
} from "lucide-react";

const MAX_FILE_SIZE = 11 * 1024 * 1024;

type ShoppingItem = {
  _id: string;
  name: string;
  quantity: number;
  imageFileId?: string;
  inCart: boolean;
};

type ShoppingListDetail = {
  _id: string;
  title: string;
  items: ShoppingItem[];
  isCompleted: boolean;
  createdBy?: { name?: string } | null;
  createdAt: string;
};

export default function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [list, setList] = useState<ShoppingListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // טופס הוספת פריט
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  // עריכת פריט קיים (inline)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // עריכת כותרת הרשימה
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopping-lists/${id}`);
      if (res.ok) setList(await res.json());
      else setError("רשימת הקניות לא נמצאה");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת הרשימה לפי id, לא לולאת render
    fetchList();
  }, [fetchList]);

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/files/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "העלאת התמונה נכשלה");
    return data.fileId as string;
  }

  async function patchItems(items: ShoppingItem[]) {
    const res = await fetch(`/api/shopping-lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      setList(await res.json());
      return true;
    }
    return false;
  }

  async function updateTitle() {
    if (!titleInput.trim()) {
      setEditingTitle(false);
      return;
    }
    const res = await fetch(`/api/shopping-lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleInput.trim() }),
    });
    if (res.ok) setList(await res.json());
    setEditingTitle(false);
  }

  async function toggleInCart(item: ShoppingItem) {
    if (!list) return;
    const updated = list.items.map((it) =>
      it._id === item._id ? { ...it, inCart: !it.inCart } : it
    );
    // עדכון אופטימי - כדי שהסימון ירגיש מיידי בזמן קניות
    setList({ ...list, items: updated });
    await patchItems(updated);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!list || !newName.trim()) return;
    setAdding(true);
    setError("");
    try {
      let imageFileId: string | undefined;
      if (newImageFile) imageFileId = await uploadImage(newImageFile);

      const newItem: ShoppingItem = {
        _id: `temp-${Date.now()}`, // יוחלף במזהה אמיתי מהשרת לאחר ה-PATCH
        name: newName.trim(),
        quantity: Number(newQuantity) || 1,
        imageFileId,
        inCart: false,
      };
      const ok = await patchItems([...list.items, newItem]);
      if (!ok) throw new Error("שגיאה בהוספת המוצר");
      setNewName("");
      setNewQuantity("1");
      setNewImageFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: ShoppingItem) {
    setEditingId(item._id);
    setEditName(item.name);
    setEditQuantity(String(item.quantity));
    setEditImageFile(null);
    setEditRemoveImage(false);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(item: ShoppingItem) {
    if (!list || !editName.trim()) return;
    setSavingEdit(true);
    setError("");
    try {
      let imageFileId = item.imageFileId;
      if (editImageFile) imageFileId = await uploadImage(editImageFile);
      else if (editRemoveImage) imageFileId = undefined;

      const updated = list.items.map((it) =>
        it._id === item._id
          ? { ...it, name: editName.trim(), quantity: Number(editQuantity) || 1, imageFileId }
          : it
      );
      const ok = await patchItems(updated);
      if (!ok) throw new Error("שגיאה בשמירת המוצר");
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!list) return;
    if (!confirm("להסיר את המוצר הזה מהרשימה?")) return;
    await patchItems(list.items.filter((it) => it._id !== itemId));
  }

  async function deleteList() {
    if (!confirm("למחוק את רשימת הקניות הזו לצמיתות?")) return;
    const res = await fetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/shopping");
  }

  if (loading) {
    return <div className="card p-8 text-center text-sm text-slate-400">טוען רשימת קניות...</div>;
  }

  if (!list) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-red-600">{error || "רשימת הקניות לא נמצאה"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          {editingTitle ? (
            <div className="flex-1 flex gap-2">
              <input
                className="input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && updateTitle()}
                autoFocus
              />
              <button onClick={updateTitle} className="btn-primary px-3" aria-label="שמירת כותרת">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-2 text-right"
              onClick={() => {
                setTitleInput(list.title);
                setEditingTitle(true);
              }}
            >
              <h1 className="text-xl font-bold">{list.title}</h1>
              <Pencil size={14} className="text-slate-400" />
            </button>
          )}
          <button onClick={deleteList} className="shrink-0 text-slate-400 hover:text-red-600">
            <Trash2 size={18} />
          </button>
        </div>

        {list.items.length > 0 && (
          <p className="text-sm text-slate-500 mt-2">
            {list.items.filter((i) => i.inCart).length} מתוך {list.items.length} בעגלה
          </p>
        )}

        {list.isCompleted && (
          <div className="mt-3 bg-emerald-50 text-emerald-800 rounded-xl p-3 flex items-center gap-2 text-sm font-medium">
            <PartyPopper size={18} /> כל המוצרים נוספו לעגלה - הרשימה הושלמה!
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {list.items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">אין מוצרים ברשימה עדיין.</p>
        )}

        {list.items.map((item) =>
          editingId === item._id ? (
            <div key={item._id} className="card p-3.5 space-y-2">
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="שם המוצר"
              />
              <input
                type="number"
                min="1"
                className="input"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                placeholder="כמות"
              />
              <ImagePicker
                currentImageFileId={editRemoveImage ? undefined : item.imageFileId}
                newFile={editImageFile}
                onPick={(f) => {
                  setEditImageFile(f);
                  setEditRemoveImage(false);
                }}
                onRemove={() => {
                  setEditImageFile(null);
                  setEditRemoveImage(true);
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(item)}
                  disabled={savingEdit}
                  className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5 disabled:opacity-60"
                >
                  <Check size={14} /> שמירה
                </button>
                <button
                  onClick={cancelEdit}
                  className="btn-secondary flex items-center gap-1 text-sm px-3 py-1.5"
                >
                  <X size={14} /> ביטול
                </button>
              </div>
            </div>
          ) : (
            <div
              key={item._id}
              className={`card flex items-center gap-3 p-3.5 ${item.inCart ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => toggleInCart(item)}
                aria-label={item.inCart ? "הסר מהעגלה" : "סמן כנוסף לעגלה"}
                className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  item.inCart ? "bg-emerald-500 border-transparent" : "border-slate-300 hover:border-teal-500"
                }`}
              >
                {item.inCart && <Check size={14} className="text-white" />}
              </button>

              {item.imageFileId && (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(`/api/files/${item.imageFileId}`)}
                  className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- תמונה דינמית מה-DB, לא נכסי build */}
                  <img
                    src={`/api/files/${item.imageFileId}`}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              )}

              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${item.inCart ? "line-through text-slate-400" : ""}`}>
                  {item.name}
                </p>
                <p className="text-xs text-slate-500">כמות: {item.quantity}</p>
              </div>

              <button onClick={() => startEdit(item)} className="shrink-0 text-slate-400 hover:text-teal-700">
                <Pencil size={16} />
              </button>
              <button onClick={() => removeItem(item._id)} className="shrink-0 text-slate-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          )
        )}
      </div>

      <form onSubmit={addItem} className="card p-4 space-y-2">
        <p className="label mb-0">הוספת מוצר</p>
        <input
          className="input"
          placeholder="שם המוצר"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="number"
          min="1"
          className="input"
          placeholder="כמות"
          value={newQuantity}
          onChange={(e) => setNewQuantity(e.target.value)}
        />
        <ImagePicker
          currentImageFileId={undefined}
          newFile={newImageFile}
          onPick={(f) => setNewImageFile(f)}
          onRemove={() => setNewImageFile(null)}
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Plus size={16} /> {adding ? "מוסיף..." : "הוסף מוצר"}
        </button>
      </form>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- תמונה דינמית מה-DB, לא נכסי build */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 left-4 text-white bg-white/10 rounded-full p-2"
            aria-label="סגירה"
          >
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/shopping"
      className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
    >
      <ArrowRight size={16} /> חזרה לרשימות קניות
    </Link>
  );
}

// בחירת/תצוגת תמונה למוצר - בשימוש גם בטופס הוספה וגם בעריכת פריט קיים.
function ImagePicker({
  currentImageFileId,
  newFile,
  onPick,
  onRemove,
}: {
  currentImageFileId?: string;
  newFile: File | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const previewUrl = newFile
    ? URL.createObjectURL(newFile)
    : currentImageFileId
    ? `/api/files/${currentImageFileId}`
    : null;

  return (
    <div className="flex items-center gap-2">
      {previewUrl ? (
        <div className="relative w-14 h-14 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה מקובץ מקומי/מה-DB */}
          <img src={previewUrl} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -left-1.5 bg-white rounded-full shadow p-0.5 text-slate-500 hover:text-red-600"
            aria-label="הסרת תמונה"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-1.5 justify-center border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 cursor-pointer hover:border-teal-500 transition-colors text-xs text-slate-500">
          <ImageIcon size={16} />
          תמונה (אופציונלי)
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > MAX_FILE_SIZE) {
                alert("הקובץ גדול מדי (מקסימום כ-11MB)");
                return;
              }
              onPick(f);
            }}
          />
        </label>
      )}
    </div>
  );
}
