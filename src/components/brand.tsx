import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-3" aria-label="Enrivea Signal home">
    <span className="flex size-9 items-center justify-center rounded-[11px] border border-[#c5ff4180] bg-[#c5ff41] text-[#0e1608] shadow-[0_0_30px_#c5ff4130]">
      <svg viewBox="0 0 28 28" className="size-6" aria-hidden="true"><path fill="currentColor" d="M4 5h20v5H10v2h11v4H10v2h14v5H4z"/><path fill="currentColor" d="M17 10h7l-7 8h-7z" opacity=".65"/></svg>
    </span>
    {!compact && <span className="flex flex-col leading-none"><span className="text-[1.06rem] font-black tracking-[-.05em]">enrivea<span className="text-accent">/</span>signal</span><span className="mt-1 text-[.56rem] font-bold uppercase tracking-[.21em] text-muted">Trade intelligence</span></span>}
  </Link>;
}
