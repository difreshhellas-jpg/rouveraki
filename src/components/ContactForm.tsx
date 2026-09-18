"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";

type State = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          message: String(data.get("message") ?? ""),
          consent: data.get("consent") === "on",
          website: String(data.get("website") ?? ""),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
      form.reset();
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p
        role="status"
        className="rounded-card border border-sand/25 bg-sand/10 p-4 text-sm"
      >
        {t("contact.success")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label text-sand/80" htmlFor="contact-name">
            {t("contact.name")}
          </label>
          <input
            id="contact-name"
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            className="field border-sand/25 bg-sand/10 text-sand placeholder:text-sand/40"
          />
        </div>
        <div>
          <label className="label text-sand/80" htmlFor="contact-email">
            {t("contact.email")}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            className="field border-sand/25 bg-sand/10 text-sand placeholder:text-sand/40"
          />
        </div>
      </div>

      <div>
        <label className="label text-sand/80" htmlFor="contact-message">
          {t("contact.message")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={4}
          maxLength={2000}
          className="field border-sand/25 bg-sand/10 text-sand placeholder:text-sand/40"
        />
      </div>

      {/* Honeypot — visually and semantically hidden, ignored by real users. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-3 text-xs leading-relaxed opacity-85">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--rouveraki-rust-rgb))]"
        />
        <span>
          {t("contact.consent")}{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            {t("legal.privacy")}
          </Link>
        </span>
      </label>

      {state === "error" && (
        <p role="alert" className="text-sm font-semibold text-[#ffb4a2]">
          {t("contact.error")}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="btn bg-rust px-8 text-onrust disabled:opacity-60"
      >
        {state === "sending" ? t("contact.sending") : t("contact.submit")}
      </button>
    </form>
  );
}
