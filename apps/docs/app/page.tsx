import { redirect } from "next/navigation";

export default function HomeRedirectPage() {
  redirect("/docs");
}
