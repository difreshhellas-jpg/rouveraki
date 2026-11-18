"use client";

import { useSearchParams } from "next/navigation";
import InstallButton, { useInstallMode, useMounted } from "@/components/InstallButton";

/**
 * The owner's direct link (/demo-kitchen?install=1): after the code, a large
 * card that installs the shop app ("Παραγγελίες") on its own, separate from
 * the customer site. Hidden once the app is installed and opened.
 */
export default function KitchenInstallCard() {
  const wanted = useSearchParams()?.get("install") === "1";
  const mode = useInstallMode();
  const mounted = useMounted();
  if (!wanted || !mounted || mode === "none") return null;
  return (
    <section className="card mb-6 space-y-3 border-2 border-gold p-5">
      <h2 className="font-display text-xl font-bold">Εφαρμογή καταστήματος</h2>
      <p className="text-sm text-char/75">
        Εγκατέστησε την οθόνη παραγγελιών σαν εφαρμογή σε αυτή τη συσκευή. Όσο είναι ανοιχτή, η
        διανομή είναι ανοιχτή στο site· όταν κλείνει, η διανομή κλείνει μόνη της.
      </p>
      <InstallButton app="kitchen" variant="pill" label="Εγκατάσταση εφαρμογής" className="!px-6 !py-3 !text-base" />
    </section>
  );
}
