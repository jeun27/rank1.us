import { redirect } from "next/navigation";

// Settings has one section for now (C-a). The proxy 404s this unless ENABLE_CONNECTIONS=true.
export default function SettingsPage() {
  redirect("/app/settings/connections");
}
