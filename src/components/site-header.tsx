import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/brand";

export function SiteHeader() {
  return <header className="relative z-20 border-b border-[#26312b] bg-[#090d0ce8] backdrop-blur-xl">
    <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
      <Brand />
      <nav aria-label="Main navigation" className="hidden items-center gap-9 text-[.87rem] font-semibold text-[#a9b5aa] md:flex">
        <Link className="hover:text-white" href="/#product">Platform</Link><Link className="hover:text-white" href="/#method">Method</Link><Link className="hover:text-white" href="/#safeguards">Safeguards</Link><Link className="hover:text-white" href="/pricing">Pricing</Link><Link className="hover:text-white" href="/about">About</Link>
      </nav>
      <div className="hidden items-center gap-5 sm:flex"><Link className="text-sm font-bold text-[#cad5c9] hover:text-white" href="/login">Sign in</Link><Link className="button-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm" href="/register">Get started <ArrowUpRight className="size-4"/></Link></div>
      <details className="group relative sm:hidden"><summary className="list-none rounded-lg border border-line p-2"><Menu className="size-5"/><span className="sr-only">Open menu</span></summary><nav className="absolute right-0 top-12 flex w-56 flex-col gap-4 rounded-xl border border-line bg-panel p-5 text-sm shadow-2xl"><Link href="/#product">Platform</Link><Link href="/#method">Method</Link><Link href="/#safeguards">Safeguards</Link><Link href="/pricing">Pricing</Link><Link href="/about">About</Link><Link href="/login">Sign in</Link><Link className="text-accent" href="/register">Get started</Link></nav></details>
    </div>
  </header>;
}
