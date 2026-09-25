"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

const KEY = "enrivea_signal_cookie_choice";
const EVENT = "enrivea-cookie-choice";
const subscribe = (callback: () => void) => { window.addEventListener(EVENT, callback); window.addEventListener("storage", callback); return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); }; };
const getSnapshot = () => localStorage.getItem(KEY);
const getServerSnapshot = () => "essential";

export function CookieConsent() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (choice) return null;
  const choose = (value: "essential" | "all") => { localStorage.setItem(KEY, value); window.dispatchEvent(new Event(EVENT)); };
  return <div role="dialog" aria-label="Cookie preferences" className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-[#4b624d] bg-[#17221a] p-5 shadow-[0_20px_100px_#000b] sm:bottom-6 sm:flex-row sm:items-center sm:p-6">
    <div className="flex-1"><strong className="text-base">Your privacy, your choice.</strong><p className="mt-1 text-sm leading-6 text-muted">Essential cookies keep your account secure. Optional analytics are off unless you allow them. <Link className="text-accent underline" href="/cookies">Cookie details</Link></p></div>
    <div className="flex shrink-0 gap-2"><button onClick={() => choose("essential")} className="button-secondary rounded-lg px-4 py-2.5 text-sm font-bold">Essential only</button><button onClick={() => choose("all")} className="button-primary rounded-lg px-4 py-2.5 text-sm">Allow all</button></div>
  </div>;
}

export function CookieSettingsButton() {
  return <button className="text-left muted hover:text-white" onClick={() => { localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVENT)); }}>Cookie settings</button>;
}
