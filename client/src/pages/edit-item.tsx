import { useRoute } from "wouter";
import ReportPage from "@/pages/report";

export default function EditItemPage() {
  const [, params] = useRoute("/item/:id/edit");
  const itemId = params?.id ? Number.parseInt(params.id, 10) : 0;

  return <ReportPage itemId={itemId} />;
}
