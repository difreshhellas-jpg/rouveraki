"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import Sheet from "@/components/Sheet";
import { CATEGORIES } from "@/lib/brand";
import { formatEuro } from "@/lib/money";
import type { MenuItemDTO } from "@/lib/menu-types";

/**
 * The owner's menu manager (demo mode). Every change is saved straight to the
 * shared menu in Vercel Blob, so customers see it on their next page load.
 * Access needs ADMIN_PASSWORD; the password is kept for this tab only.
 */
const KEY_STORE = "rouveraki.admin-key";
/** This device's last successful save; see readLastSave. */
const LAST_SAVE = "rouveraki.menu-last-save";

type Doc = { items: MenuItemDTO[]; savedAt: string | null };

/**
 * The store can serve the previous version for a few seconds after a save,
 * so a reload right after saving prefers this device's newer copy. Without it
 * the next toggle would save the older list back over the edit.
 */
const readLastSave = (): Doc | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST_SAVE) ?? "null") as Doc | null;
  } catch {
    return null;
  }
};
const money = (c: number) => formatEuro(c / 100, "el-GR");
const catLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.el ?? slug;

const readKey = () => {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
};

export default function MenuManagerPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<MenuItemDTO[] | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "busy"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [editing, setEditing] = useState<MenuItemDTO | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const check = useCallback(async (candidate: string) => {
    const res = await fetch("/api/live-menu", {
      method: "POST",
      headers: { "x-admin-key": candidate },
    });
    if (!res.ok) return false;
    try {
      sessionStorage.setItem(KEY_STORE, candidate);
    } catch {
      /* private mode: the password is simply asked again next time */
    }
    setKey(candidate);
    setAuthed(true);
    return true;
  }, []);

  useEffect(() => {
    const saved = readKey();
    if (saved) void check(saved);
  }, [check]);

  /** The saved menu, or null when it could not be read (never a fallback copy). */
  const fetchMenu = useCallback(async (): Promise<MenuItemDTO[] | null> => {
    try {
      const r = await fetch("/api/live-menu", { cache: "no-store" });
      if (!r.ok) return null;
      const doc = (await r.json()) as Doc;
      const mine = readLastSave();
      return mine?.savedAt && (!doc.savedAt || mine.savedAt > doc.savedAt) ? mine.items : doc.items;
    } catch {
      return null;
    }
  }, []);

  const reload = useCallback(async () => {
    const fresh = await fetchMenu();
    setLoadFailed(!fresh);
    if (fresh) setItems(fresh);
  }, [fetchMenu]);

  useEffect(() => {
    if (authed) void reload();
  }, [authed, reload]);

  // Messages fade on their own; errors stay a little longer.
  useEffect(() => {
    if (!status || status.kind === "busy") return;
    const id = window.setTimeout(() => setStatus(null), status.kind === "ok" ? 3000 : 6000);
    return () => window.clearTimeout(id);
  }, [status]);

  /** Saves the whole list; on failure the screen reloads the last saved menu. */
  const save = async (next: MenuItemDTO[], okText: string) => {
    setItems(next);
    setStatus({ kind: "busy", text: "Αποθήκευση..." });
    let res: Response | null = null;
    try {
      res = await fetch("/api/live-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ items: next }),
      });
    } catch {
      /* offline: handled below like any other failed save */
    }
    if (res?.ok) {
      try {
        const { savedAt } = (await res.json()) as { savedAt: string };
        localStorage.setItem(LAST_SAVE, JSON.stringify({ items: next, savedAt }));
      } catch {
        /* storage full or blocked: the store's copy catches up within seconds */
      }
      setStatus({ kind: "ok", text: okText });
      return true;
    }
    if (res?.status === 401) {
      // The password changed: forget it and show the login again.
      try {
        sessionStorage.removeItem(KEY_STORE);
      } catch {
        /* nothing stored */
      }
      setAuthed(false);
      setEditing(null);
    }
    setStatus({
      kind: "error",
      text:
        res?.status === 401
          ? "Λάθος κωδικός - κάνε ξανά είσοδο."
          : "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.",
    });
    await reload();
    return false;
  };

  const saving = status?.kind === "busy";

  const toggle = (item: MenuItemDTO) => {
    // One save at a time: each one sends the whole list, so two in flight
    // could land out of order and undo each other.
    if (saving) return;
    void save(
      (items ?? []).map((i) => (i.id === item.id ? { ...i, available: !i.available } : i)),
      `«${item.name}»: ${item.available ? "εξαντλήθηκε" : "ξανά διαθέσιμο"}`,
    );
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q) || (i.nameEn ?? "").toLowerCase().includes(q)),
    );
  }, [items, query, category]);

  const soldOut = (items ?? []).filter((i) => !i.available).length;

  if (!authed) return <Login onSubmit={check} />;

  return (
    <div className="min-h-svh bg-sand pb-24">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold">
            Μενού <span className="text-char/50">διαχείριση</span>
          </h1>
          <div className="ml-auto flex gap-2">
            <Link href="/demo-kitchen" className="btn-secondary text-sm">
              Παραγγελίες
            </Link>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!items}
              onClick={() => items && setEditing(blankItem(items, category))}
            >
              + Νέο προϊόν
            </button>
          </div>
        </header>

        <p className="mt-2 text-sm text-char/65">
          Οι αλλαγές αποθηκεύονται αμέσως και φαίνονται στους πελάτες στην επόμενη φόρτωση της σελίδας.
          {items && ` ${items.length} προϊόντα · ${soldOut} εξαντλημένα.`}
        </p>

        <div className="mt-5 space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση προϊόντος..."
            className="field"
            aria-label="Αναζήτηση προϊόντος"
          />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[{ slug: "all", el: "Όλα" }, ...CATEGORIES].map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCategory(c.slug)}
                className={clsx(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
                  category === c.slug ? "border-rust bg-rust text-onrust" : "border-line bg-surface",
                )}
              >
                {c.el}
              </button>
            ))}
          </div>
        </div>

        {!items ? (
          loadFailed ? (
            <div role="alert" className="py-16 text-center text-char/70">
              <p>Το μενού δεν φορτώθηκε.</p>
              <button type="button" onClick={() => void reload()} className="btn-secondary mt-4">
                Δοκίμασε ξανά
              </button>
            </div>
          ) : (
            <p className="py-16 text-center text-char/60">Φόρτωση...</p>
          )
        ) : (
          <ul className="card mt-5 divide-y divide-line">
            {shown.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-char/10">
                    {item.image && (
                      // Plain <img>: owner uploads are already resized, and this is an admin list.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="size-full object-cover" loading="lazy" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={clsx("block font-semibold leading-snug", !item.available && "text-char/45 line-through")}>
                      {item.name}
                    </span>
                    <span className="block text-sm text-char/60">
                      {money(item.priceCents)} · {catLabel(item.category)}
                      {!item.available && <span className="font-semibold text-rust"> · Εξαντλήθηκε</span>}
                    </span>
                  </span>
                </button>
                <AvailabilitySwitch item={item} disabled={saving} onToggle={() => toggle(item)} />
              </li>
            ))}
            {shown.length === 0 && (
              <li className="p-8 text-center text-sm text-char/55">Κανένα προϊόν δεν ταιριάζει.</li>
            )}
          </ul>
        )}
      </div>

      {status && (
        <p
          role="status"
          className={clsx(
            // Above the edit sheet (z-60) so a failed save from it is seen, and
            // at the top so it never covers the sheet's Save button.
            "fixed inset-x-4 top-4 z-[70] mx-auto max-w-md rounded-card px-4 py-3 text-center text-sm font-semibold shadow-card",
            status.kind === "error" ? "bg-rust text-onrust" : "bg-char text-sand",
          )}
        >
          {status.text}
        </p>
      )}

      {editing && (
        <EditSheet
          item={editing}
          adminKey={key}
          isNew={!items?.some((i) => i.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            const list = items ?? [];
            const exists = list.some((i) => i.id === next.id);
            const ok = await save(
              exists ? list.map((i) => (i.id === next.id ? next : i)) : [...list, next],
              `«${next.name}» αποθηκεύτηκε`,
            );
            if (ok) setEditing(null);
          }}
          onDelete={async () => {
            const ok = await save(
              (items ?? []).filter((i) => i.id !== editing.id),
              `«${editing.name}» διαγράφηκε`,
            );
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ---- pieces -------------------------------------------------------------- */

function Login({ onSubmit }: { onSubmit: (key: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-svh items-center justify-center bg-sand px-4">
      <form
        className="card w-full max-w-sm space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setWrong(!(await onSubmit(value)));
          setBusy(false);
        }}
      >
        <h1 className="font-display text-2xl font-bold">Διαχείριση μενού</h1>
        <div>
          <label className="label" htmlFor="admin-key">
            Κωδικός
          </label>
          <input
            id="admin-key"
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

function AvailabilitySwitch({
  item,
  disabled,
  onToggle,
}: {
  item: MenuItemDTO;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={item.available}
      // The label names the setting; aria-checked already says on/off.
      aria-label={`${item.name}: διαθέσιμο`}
      disabled={disabled}
      onClick={onToggle}
      className={clsx(
        "flex min-h-touch shrink-0 items-center gap-2 rounded-full px-2.5 text-xs font-bold disabled:opacity-60",
        item.available ? "bg-emerald-600/12 text-emerald-800" : "bg-rust/12 text-rust",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          item.available ? "bg-emerald-600" : "bg-rust/60",
        )}
      >
        <span
          className={clsx(
            "absolute left-0 top-0.5 size-4 rounded-full bg-white shadow transition-transform",
            item.available ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="hidden text-left sm:inline sm:w-[5.5rem]">{item.available ? "Διαθέσιμο" : "Εξαντλήθηκε"}</span>
    </button>
  );
}

function EditSheet({
  item,
  adminKey,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  item: MenuItemDTO;
  adminKey: string;
  isNew: boolean;
  onClose: () => void;
  onSave: (next: MenuItemDTO) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(item);
  const [price, setPrice] = useState((item.priceCents / 100).toFixed(2).replace(".", ","));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MenuItemDTO>(k: K, v: MenuItemDTO[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", await shrink(file));
      const res = await fetch("/api/live-menu/image", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body,
      });
      if (!res.ok) throw new Error();
      set("image", ((await res.json()) as { url: string }).url);
    } catch {
      setError("Η φωτογραφία δεν ανέβηκε. Δοκίμασε άλλη (JPG ή PNG).");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const raw = price.trim().replace(",", ".");
    const cents = Math.round(Number(raw) * 100);
    if (!draft.name.trim()) return setError("Γράψε όνομα προϊόντος.");
    // An empty box would otherwise read as 0 and put the item on sale for free.
    if (!raw || !Number.isFinite(cents) || cents < 0 || cents > 100_000) {
      return setError("Η τιμή δεν είναι σωστή (π.χ. 4,50).");
    }
    setError(null);
    setBusy(true);
    await onSave({
      ...draft,
      name: draft.name.trim(),
      nameEn: draft.nameEn?.trim() || null,
      description: draft.description?.trim() || null,
      descriptionEn: draft.descriptionEn?.trim() || null,
      priceCents: cents,
    });
    setBusy(false);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Νέο προϊόν" : "Επεξεργασία προϊόντος"}
      titleId="menu-edit-title"
      footer={
        <div className="flex gap-2">
          {!isNew &&
            (confirmDelete ? (
              <button type="button" disabled={busy} onClick={() => void onDelete()} className="btn flex-1 bg-rust text-onrust">
                Σίγουρα διαγραφή;
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-ghost text-rust">
                Διαγραφή
              </button>
            ))}
          <button
            type="button"
            disabled={busy || uploading}
            onClick={() => void submit()}
            className="btn-primary flex-1 disabled:opacity-60"
          >
            Αποθήκευση
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 pb-5">
        <div className="flex items-center gap-4">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-char/10">
            {draft.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.image} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="btn-secondary text-sm disabled:opacity-60"
            >
              {uploading ? "Ανέβασμα..." : draft.image ? "Αλλαγή φωτογραφίας" : "Προσθήκη φωτογραφίας"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <Field label="Όνομα" id="f-name">
          <input id="f-name" className="field" maxLength={120} value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Περιγραφή" id="f-desc">
          <textarea
            id="f-desc"
            className="field resize-none"
            rows={3}
            maxLength={600}
            value={draft.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Τιμή (€)" id="f-price">
            <input
              id="f-price"
              className="field"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="Κατηγορία" id="f-cat">
            <select id="f-cat" className="field" value={draft.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.el}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={draft.available}
            onChange={(e) => set("available", e.target.checked)}
            className="size-5 accent-[rgb(var(--rouveraki-rust-rgb))]"
          />
          <span className="font-semibold">Διαθέσιμο (ξετσέκαρε αν εξαντλήθηκε)</span>
        </label>

        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">Αγγλικά (προαιρετικά)</summary>
          <div className="mt-3 space-y-3">
            <Field label="Name (English)" id="f-name-en">
              <input id="f-name-en" className="field" maxLength={120} value={draft.nameEn ?? ""} onChange={(e) => set("nameEn", e.target.value)} />
            </Field>
            <Field label="Description (English)" id="f-desc-en">
              <textarea
                id="f-desc-en"
                className="field resize-none"
                rows={2}
                maxLength={600}
                value={draft.descriptionEn ?? ""}
                onChange={(e) => set("descriptionEn", e.target.value)}
              />
            </Field>
          </div>
        </details>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rust">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function blankItem(items: MenuItemDTO[], category: string): MenuItemDTO {
  return {
    id: Math.max(0, ...items.map((i) => i.id)) + 1,
    name: "",
    nameEn: null,
    description: null,
    descriptionEn: null,
    priceCents: 0,
    category: category === "all" ? CATEGORIES[0].slug : category,
    image: null,
    available: true,
    prepTimeMinutes: 10,
    requiresAgeVerification: false,
  };
}

/** Phone photos are several MB; resize to 1200 px JPEG before uploading. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82),
  );
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
