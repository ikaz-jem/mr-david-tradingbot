"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AdminActivityRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <button type="button" onClick={() => router.refresh()} className="button-secondary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"><RefreshCw className="size-3.5"/> Refresh · auto 20s</button>;
}
