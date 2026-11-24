import { notFound } from "next/navigation";
import { DetailView } from "@/components/DetailView";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "expenses" && kind !== "income") notFound();
  return <DetailView kind={kind} />;
}
