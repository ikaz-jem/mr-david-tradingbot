"use client";
import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
export function HelpFeedback({ articleId }: { articleId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "yes" | "no">("idle");
  const [error, setError] = useState("");
  async function send(helpful: boolean) {
    setState("busy"); setError("");
    try { const response = await fetch("/api/help/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, helpful }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save feedback."); setState(helpful ? "yes" : "no"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save feedback."); setState("idle"); }
  }
  return <div className="mt-12 rounded-[20px] border border-line bg-[#111a13] p-6"><p className="font-bold">Was this guide helpful?</p><p className="mt-1 text-xs text-muted">Your response helps us improve this Help Center.</p><div className="mt-4 flex gap-2"><button disabled={state === "busy"} onClick={() => void send(true)} className={"inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold " + (state === "yes" ? "border-accent bg-accent text-black" : "border-line text-[#bdd0b8]")}><ThumbsUp className="size-4"/>Yes</button><button disabled={state === "busy"} onClick={() => void send(false)} className={"inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold " + (state === "no" ? "border-accent bg-accent text-black" : "border-line text-[#bdd0b8]")}><ThumbsDown className="size-4"/>Not yet</button></div>{(state === "yes" || state === "no") && <p role="status" className="mt-3 text-xs text-accent">Thanks—your feedback was saved.</p>}{error && <p role="alert" className="mt-3 text-xs text-[#ffad96]">{error}</p>}</div>;
}
