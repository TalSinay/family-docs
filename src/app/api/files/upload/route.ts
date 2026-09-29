import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import FileModel from "@/lib/models/File";

// מגבלה מעשית: מסמך Mongo בודד מוגבל ל-16MB. משאירים מרווח בטוח.
const MAX_FILE_SIZE = 11 * 1024 * 1024; // 11MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "הקובץ גדול מדי (מקסימום כ-11MB)" },
      { status: 413 }
    );
  }

  await connectToDatabase();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const saved = await FileModel.create({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    data: buffer,
  });

  return NextResponse.json({
    fileId: saved._id.toString(),
    fileName: saved.filename,
    fileMimeType: saved.mimeType,
    fileSize: saved.size,
  });
}
