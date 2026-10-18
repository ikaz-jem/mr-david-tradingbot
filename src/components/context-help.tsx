import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
export function ContextHelp({ href, label }: { href: string; label: string }) { return <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3e573b] bg-[#132016] px-4 py-3 text-xs"><span className="inline-flex items-center gap-2 text-[#a9bda9]"><BookOpen className="size-4 text-accent"/> Need a walkthrough?</span><Link href={href} className="inline-flex items-center gap-1 font-bold text-accent hover:underline">{label}<ArrowRight className="size-3"/></Link></div>; }
