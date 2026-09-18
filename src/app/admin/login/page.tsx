"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin/AdminAuth";

export default function AdminLoginPage() {
  const { signIn, session, ready } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace("/admin/orders");
  }, [ready, session, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) {
      // Deliberately generic: a precise message tells an attacker which half of
      // the pair was right.
      setError("Λάθος στοιχεία σύνδεσης.");
      setBusy(false);
      return;
    }
    router.replace("/admin/orders");
  };

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold">Ρουβεράκι admin</h1>

        <div>
          <label className="label" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="admin-password">
            Κωδικός
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="field"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rust">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Σύνδεση..." : "Σύνδεση"}
        </button>
      </form>
    </div>
  );
}
