"use client";

import { useEffect, useState } from "react";
import { checkAdminKey, readAdminKey, writeAdminKey } from "@/lib/admin-key";

/** Asks for the owner's password before showing the shop screens. */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "out" | "in">("checking");
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = readAdminKey();
    void checkAdminKey(saved).then((ok) => setState(ok ? "in" : "out"));
  }, []);

  if (state === "in") return <>{children}</>;
  if (state === "checking") return <div className="min-h-svh bg-sand" />;

  return (
    <div className="flex min-h-svh items-center justify-center bg-sand px-4">
      <form
        className="card w-full max-w-sm space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await checkAdminKey(value).catch(() => false);
          setBusy(false);
          setWrong(!ok);
          if (ok) {
            writeAdminKey(value);
            setState("in");
          }
        }}
      >
        <h1 className="font-display text-2xl font-bold">Ρουβεράκι · κατάστημα</h1>
        <div>
          <label className="label" htmlFor="gate-key">
            Κωδικός
          </label>
          <input
            id="gate-key"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="field"
            required
          />
        </div>
        {wrong && (
          <p role="alert" className="text-sm font-semibold text-rust">
            Λάθος κωδικός.
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          Είσοδος
        </button>
      </form>
    </div>
  );
}
