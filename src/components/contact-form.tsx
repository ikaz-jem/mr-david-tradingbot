"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Message not sent.");
      setSent(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Message not sent."); }
    finally { setPending(false); }
  }
  if (sent) return <div role="status" className="surface rounded-[22px] border-[#5c7548] p-8"><div className="text-2xl font-bold">Message received.</div><p className="mt-3 text-base leading-7 text-muted">Thanks for writing to Enrivea Signal. We&apos;ll respond by email when the team has reviewed your note.</p></div>;
  return <form onSubmit={submit} className="surface space-y-5 rounded-[22px] p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="contact-name" className="mb-2 block text-sm font-bold">Your name</label><Input id="contact-name" name="name" minLength={2} maxLength={100} required autoComplete="name" className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] text-white"/></div><div><label htmlFor="contact-email" className="mb-2 block text-sm font-bold">Email address</label><Input id="contact-email" name="email" type="email" required autoComplete="email" className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] text-white"/></div></div><div><label htmlFor="contact-topic" className="mb-2 block text-sm font-bold">What is this about?</label><select id="contact-topic" name="topic" className="h-12 w-full rounded-xl border border-[#3b4b40] bg-[#151e17] px-3 text-white"><option>Product question</option><option>Account help</option><option>Partnership</option><option>Other</option></select></div><div><label htmlFor="contact-message" className="mb-2 block text-sm font-bold">Message</label><textarea id="contact-message" name="message" minLength={20} maxLength={3000} rows={7} required placeholder="Tell us what you need help with. Please do not include passwords or exchange API keys." className="w-full rounded-xl border border-[#3b4b40] bg-[#151e17] p-3 text-white placeholder:text-[#7d8e80]"/></div><div className="hidden" aria-hidden="true"><label htmlFor="contact-website">Website</label><Input id="contact-website" name="website" tabIndex={-1} autoComplete="off"/></div>{error && <p role="alert" className="rounded-lg border border-[#b8464b] bg-[#b8464b20] p-3 text-sm text-[#ffb5b8]">{error}</p>}<div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-xs text-xs leading-5 text-muted">Messages are sent securely to the Enrivea team. Do not share credentials or trading secrets.</p><Button type="submit" disabled={pending} className="button-primary h-12 rounded-xl px-6 text-sm">{pending ? "Sending…" : "Send message"}<ArrowUpRight className="ml-2 size-4"/></Button></div></form>;
}
