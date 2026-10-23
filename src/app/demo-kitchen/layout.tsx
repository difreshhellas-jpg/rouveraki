import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminAuthProvider } from "@/components/admin/AdminAuth";
import { DEMO_MODE } from "@/lib/demo/config";

export const metadata: Metadata = {
  title: "Demo - Οθόνη καταστήματος",
  robots: { index: false, follow: false },
};

/** Shop-owner view for demos. Does not exist unless NEXT_PUBLIC_DEMO_MODE=true. */
export default function DemoKitchenLayout({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE) notFound();
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
