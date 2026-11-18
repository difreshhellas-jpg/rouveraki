"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import InstallButton, { useInstallMode, useMounted } from "@/components/InstallButton";

/** The Windows app (apps/windows): a direct download, installs itself on first run. */
export const WINDOWS_APP_URL = "/downloads/Rouveraki-Paragelies.exe";

/**
 * The owner's link (/demo-kitchen?install=1): after the code, a large card to
 * get the shop app ("Παραγγελίες") on this device, separate from the customer
 * site. On Windows it downloads the app; elsewhere it installs from the
 * browser. Hidden when already running as the app.
 */
export default function KitchenInstallCard() {
  const wanted = useSearchParams()?.get("install") === "1";
  const mode = useInstallMode();
  const mounted = useMounted();
  const [windows, setWindows] = useState(false);
  useEffect(() => setWindows(/Windows/i.test(navigator.userAgent)), []);
  if (!wanted || !mounted || mode === "none") return null;
  return (
    <section className="card mb-6 space-y-3 border-2 border-gold p-5">
      <h2 className="font-display text-xl font-bold">Εφαρμογή καταστήματος</h2>
      <p className="text-sm text-char/75">
        Όσο η εφαρμογή είναι ανοιχτή, η διανομή είναι ανοιχτή στο site· όταν κλείνει, η διανομή
        κλείνει μόνη της.
      </p>
      {windows ? (
        <>
          <a href={WINDOWS_APP_URL} download className="btn-primary !px-6 !py-3 text-base">
            ⬇ Λήψη εφαρμογής για Windows
          </a>
          <p className="text-sm text-char/60">
            Άνοιξε το αρχείο που κατέβηκε. Αν τα Windows πουν «Τα Windows προστάτευσαν τον
            υπολογιστή σας», πάτα «Περισσότερες πληροφορίες» → «Εκτέλεση οπωσδήποτε». Μπαίνει εικονίδιο
            στην επιφάνεια εργασίας και ανοίγει μόνη της με τον υπολογιστή.
          </p>
        </>
      ) : (
        <InstallButton app="kitchen" variant="pill" label="Εγκατάσταση εφαρμογής" className="!px-6 !py-3 !text-base" />
      )}
    </section>
  );
}
