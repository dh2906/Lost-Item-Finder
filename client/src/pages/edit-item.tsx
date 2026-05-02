import { useRoute } from "wouter";
import ReportPage from "@/pages/report";

export default function EditItemPage() {
  const [, stepParams] = useRoute("/item/:id/edit/:step");
  const [, baseParams] = useRoute("/item/:id/edit");
  const params = stepParams ?? baseParams;
  const itemId = params?.id ? Number.parseInt(params.id, 10) : 0;

  return <ReportPage itemId={itemId} />;
}
