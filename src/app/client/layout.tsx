import { AppHeader } from "@/components/auth/AppHeader";

export default function ClientLayout({ children }: LayoutProps<"/client">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
