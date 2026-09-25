import Link from "next/link";
import { ArrowUpRight, CircleCheck } from "lucide-react";
import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell relative flex min-h-screen flex-col bg-[#090f0b]">
    <div className="pointer-events-none absolute inset-0 grid-glow opacity-15"/>
    <div className="relative z-10 flex h-20 items-center justify-between border-b border-[#354b32] bg-[#08120ad9] px-5 backdrop-blur-xl sm:px-10"><Brand/><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#c5d9bb] hover:text-accent">Back to site <ArrowUpRight className="size-4"/></Link></div>
    <div className="relative grid flex-1 lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">{children}</div>
      <div className="auth-art relative hidden overflow-hidden border-l border-[#4a6739] px-14 py-16 lg:flex lg:flex-col lg:justify-end">
        <div className="auth-art-wash pointer-events-none absolute inset-0"/>
        <div className="relative max-w-lg"><span className="eyebrow">A product of Enrivea</span><h2 className="mt-5 text-5xl font-bold leading-[1.03] tracking-[-.06em]">A workspace for<br/><span className="text-accent">better decisions.</span></h2><p className="mt-6 text-lg leading-8 text-[#d2e3c7]">Discover the setup. Understand the risk. Keep control of every order.</p><div className="mt-10 rounded-[22px] border border-[#749647] bg-[#0b170dd9] p-6 shadow-[0_20px_70px_#0009]"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#aabd9d]"><span>Research principle</span><span className="text-accent">01 / 03</span></div><p className="mt-6 text-xl font-semibold leading-8">A useful signal explains what would make it wrong.</p><div className="mt-5 flex items-center gap-2 border-t border-[#3b5732] pt-4 text-xs font-bold uppercase tracking-wider text-accent"><CircleCheck className="size-4"/> Clarity before conviction</div></div></div>
      </div>
    </div>
  </main>;
}
