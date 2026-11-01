import Link from "next/link";
import { DEMO_MODE, LAUNCHED } from "@/lib/demo/config";

/** Small fixed pill so nobody mistakes the demo for the live shop. */
export default function DemoBadge() {
  if (!DEMO_MODE || LAUNCHED) return null;
  return (
    <Link
      href="/demo-kitchen"
      title="Demo: άνοιγμα οθόνης καταστήματος / open shop-owner view"
      className="fixed bottom-0 left-3 z-[60] rounded-t-md bg-char/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:bg-char"
    >
      Demo
    </Link>
  );
}
