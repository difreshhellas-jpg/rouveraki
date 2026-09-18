"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAdminAuth } from "@/components/admin/AdminAuth";
import { CATEGORIES, AGE_GATED_CATEGORIES } from "@/lib/brand";
import { formatEuro } from "@/lib/money";

type AdminMenuItem = {
  id: number;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  priceCents: number;
  category: string;
  image: string | null;
  available: boolean;
  prepTimeMinutes: number;
  requiresAgeVerification: boolean;
  sortOrder: number;
};

type Draft = Omit<AdminMenuItem, "id"> & { id: number | null };

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  nameEn: "",
  description: "",
  descriptionEn: "",
  priceCents: 0,
  category: CATEGORIES[0].slug,
  image: "",
  available: true,
  prepTimeMinutes: 10,
  requiresAgeVerification: false,
  sortOrder: 0,
});

export default function AdminMenuPage() {
  const { authFetch } = useAdminAuth();
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/menu");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: AdminMenuItem[] };
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  const toggleAvailable = async (item: AdminMenuItem) => {
    setBusyId(item.id);
    // Optimistic: the 86'd-item toggle is the single most used control here and
    // it must feel instant. Reverted from the server response on failure.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, available: !i.available } : i)),
    );
    try {
      const res = await authFetch(`/api/admin/menu/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, available: item.available } : i)),
      );
      setError("Η αλλαγή δεν αποθηκεύτηκε.");
    } finally {
      setBusyId(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusyId(draft.id ?? "new");
    setError(null);

    const body = {
      name: draft.name,
      nameEn: draft.nameEn || null,
      description: draft.description || null,
      descriptionEn: draft.descriptionEn || null,
      priceCents: draft.priceCents,
      category: draft.category,
      image: draft.image || null,
      available: draft.available,
      prepTimeMinutes: draft.prepTimeMinutes,
      requiresAgeVerification: draft.requiresAgeVerification,
      sortOrder: draft.sortOrder,
    };

    try {
      const res = await authFetch(
        draft.id ? `/api/admin/menu/${draft.id}` : "/api/admin/menu",
        { method: draft.id ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) throw new Error(String(res.status));
      setDraft(null);
      await load();
    } catch (e) {
      setError(`Δεν αποθηκεύτηκε: ${e instanceof Error ? e.message : "σφάλμα"}`);
    } finally {
      setBusyId(null);
    }
  };

  const categoryIsGated = draft
    ? AGE_GATED_CATEGORIES.includes(draft.category)
    : false;

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Μενού</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="field w-auto"
          aria-label="Φίλτρο κατηγορίας"
        >
          <option value="all">Όλες οι κατηγορίες</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.el}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="btn-primary ml-auto text-sm"
        >
          Νέο προϊόν
        </button>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-card border border-rust/40 bg-rust/10 p-3 text-sm text-rust">
          {error}
        </p>
      )}

      {/* ---- editor ------------------------------------------------------ */}
      {draft && (
        <section className="card mb-6 space-y-4 p-5">
          <h2 className="font-display text-lg font-bold">
            {draft.id ? "Επεξεργασία προϊόντος" : "Νέο προϊόν"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Όνομα (ΕΛ)">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={255}
                className="field"
              />
            </Field>
            <Field label="Όνομα (EN)">
              <input
                value={draft.nameEn ?? ""}
                onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
                maxLength={255}
                className="field"
              />
            </Field>
            <Field label="Περιγραφή (ΕΛ)">
              <textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                maxLength={600}
                className="field resize-none"
              />
            </Field>
            <Field label="Περιγραφή (EN)">
              <textarea
                value={draft.descriptionEn ?? ""}
                onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })}
                rows={2}
                maxLength={600}
                className="field resize-none"
              />
            </Field>
            <Field label="Τιμή (€)">
              <input
                type="number"
                step="0.10"
                min="0"
                max="999.99"
                value={(draft.priceCents / 100).toFixed(2)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priceCents: Math.round(Number(e.target.value || 0) * 100),
                  })
                }
                className="field"
              />
            </Field>
            <Field label="Κατηγορία">
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.el}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Χρόνος ετοιμασίας (λεπτά)">
              <input
                type="number"
                min={0}
                max={240}
                value={draft.prepTimeMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, prepTimeMinutes: Number(e.target.value || 0) })
                }
                className="field"
              />
            </Field>
            <Field label="Σειρά εμφάνισης">
              <input
                type="number"
                min={0}
                max={9999}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: Number(e.target.value || 0) })
                }
                className="field"
              />
            </Field>
            <Field label="URL φωτογραφίας">
              <input
                value={draft.image ?? ""}
                onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                placeholder="https://..."
                className="field"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
                className="size-5 accent-[rgb(var(--rouveraki-rust-rgb))]"
              />
              Διαθέσιμο
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={categoryIsGated || draft.requiresAgeVerification}
                disabled={categoryIsGated}
                onChange={(e) =>
                  setDraft({ ...draft, requiresAgeVerification: e.target.checked })
                }
                className="size-5 accent-[rgb(var(--rouveraki-rust-rgb))]"
              />
              Απαιτεί επιβεβαίωση 18+
              {categoryIsGated && (
                <span className="font-normal text-char/55">
                  (πάντα ενεργό για τα Ποτά)
                </span>
              )}
            </label>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="btn-secondary">
              Άκυρο
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!draft.name.trim() || busyId !== null}
              className="btn-primary disabled:opacity-60"
            >
              Αποθήκευση
            </button>
          </div>
        </section>
      )}

      {/* ---- list -------------------------------------------------------- */}
      {loading ? (
        <p className="py-16 text-center text-char/60">Φόρτωση...</p>
      ) : (
        <div className="card divide-y divide-line">
          {visible.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className={clsx("font-semibold", !item.available && "line-through opacity-55")}>
                  {item.name}
                  {item.requiresAgeVerification && (
                    <span className="ml-2 rounded-full bg-rust/10 px-2 py-0.5 text-xs font-bold text-rust">
                      18+
                    </span>
                  )}
                </p>
                <p className="text-sm text-char/55">
                  {CATEGORIES.find((c) => c.slug === item.category)?.el ?? item.category}
                  {" · "}
                  {formatEuro(item.priceCents / 100)}
                  {" · "}~{item.prepTimeMinutes}′
                </p>
              </div>

              <button
                type="button"
                onClick={() => void toggleAvailable(item)}
                disabled={busyId === item.id}
                className={clsx(
                  "btn min-h-10 px-4 text-sm",
                  item.available
                    ? "bg-emerald-600/10 text-emerald-700"
                    : "bg-char/10 text-char/60",
                )}
              >
                {item.available ? "Διαθέσιμο" : "Μη διαθέσιμο"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...item,
                    nameEn: item.nameEn ?? "",
                    description: item.description ?? "",
                    descriptionEn: item.descriptionEn ?? "",
                    image: item.image ?? "",
                  })
                }
                className="btn-ghost min-h-10 text-sm"
              >
                Επεξεργασία
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="p-8 text-center text-char/55">Κανένα προϊόν.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
