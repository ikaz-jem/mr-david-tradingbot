"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaperOutcomeRefresh() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/paper/reconcile", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Paper outcomes unavailable");
      setMessage(result.failures.length ? `${result.updated} updated; ${result.failures.length} could not be checked. Try later.` : `${result.updated} outcome${result.updated === 1 ? "" : "s"} checked.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Paper outcomes unavailable"); }
    finally { setPending(false); }
  }
  return <div className="flex flex-wrap items-center gap-3"><Button onClick={refresh} disabled={pending} className="button-secondary h-10 rounded-xl px-4 text-sm font-bold">{pending ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : <RotateCw className="mr-2 size-4"/>}Refresh paper outcomes</Button>{message && <span role="status" className="text-xs text-muted">{message}</span>}</div>;
}
