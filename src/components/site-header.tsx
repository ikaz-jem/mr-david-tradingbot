import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/brand";

export function SiteHeader() {
  return <header className="site-header sticky top-0 z-50 border-b border-[#385135] bg-[#08110be8] backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-[1520px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
      <Brand />
      <nav aria-label="Main navigation" className="hidden items-center gap-8 text-[.84rem] font-bold text-[#bfceba] lg:flex">
        <Link className="site-nav-link" href="/#product">Platform</Link><Link className="site-nav-link" href="/#method">Method</Link><Link className="site-nav-link" href="/#decision-file">Decision file</Link><Link className="site-nav-link" href="/pricing">Pricing</Link><Link className="site-nav-link" href="/about">About</Link>
      </nav>
      <div className="hidden items-center gap-5 lg:flex"><Link className="text-sm font-bold text-[#cad5c9] hover:text-white" href="/login">Sign in</Link><Link className="button-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm" href="/register">Get started <ArrowUpRight className="size-4"/></Link></div>
      <details className="group relative lg:hidden"><summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[#49643b] bg-[#142015] text-accent marker:hidden"><Menu className="size-5"/><span className="sr-only">Open menu</span></summary><nav aria-label="Mobile navigation" className="site-mobile-menu absolute right-0 top-14 flex w-[min(88vw,320px)] flex-col gap-1 rounded-2xl border border-[#4d6a3b] bg-[#101b12] p-3 text-sm shadow-2xl"><Link href="/#product">Platform</Link><Link href="/#method">Method</Link><Link href="/#decision-file">Decision file</Link><Link href="/#safeguards">Safeguards</Link><Link href="/pricing">Pricing</Link><Link href="/about">About</Link><span className="my-1 border-t border-[#344b31]"/><Link href="/login">Sign in</Link><Link className="text-accent" href="/register">Get started <ArrowUpRight className="size-4"/></Link></nav></details>
    </div>
  </header>;
}
