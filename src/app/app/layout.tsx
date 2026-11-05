import { AppHeader } from "@/components/auth/AppHeader";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
