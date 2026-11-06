import { notFound } from "next/navigation";

// GAS UI/UX prototypes (Example data, no backend). 404 in production, like every /dev route.
export default function DevGasLayout({ children }: LayoutProps<"/dev/gas">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return children;
}
