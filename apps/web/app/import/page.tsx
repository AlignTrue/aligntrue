import { BulkImportClient } from "./BulkImportClient";

export const metadata = {
  title: "Bulk Import Aligns",
  description: "Import multiple Align rules at once or bundle them as a pack.",
};

export default function ImportPage() {
  return <BulkImportClient />;
}
