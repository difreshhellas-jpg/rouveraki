import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminAuthProvider } from "@/components/admin/AdminAuth";
import AdminGate from "@/components/admin/AdminGate";
import { DEMO_MODE } from "@/lib/demo/config";

export const metadata: Metadata = {
  title: "Οθόνη καταστήματος",
  robots: { index: false, follow: false },
  // Installs as its own app ("Παραγγελίες") that opens straight on this screen.
  manifest: "/kitchen.webmanifest",
  appleWebApp: { capable: true, title: "Παραγγελίες", statusBarStyle: "default" },
};

/** Shop-owner view for demos. Does not exist unless NEXT_PUBLIC_DEMO_MODE=true. */
export default function DemoKitchenLayout({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE) notFound();
  return (
    <AdminAuthProvider>
      <AdminGate>{children}</AdminGate>
    </AdminAuthProvider>
  );
}
