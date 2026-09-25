import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <><SiteHeader /><div className="marketing-pages">{children}</div><SiteFooter /></>;
}
