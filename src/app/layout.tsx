import type { Metadata } from "next";
import "./globals.css";
import { CookieConsent } from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: { default: "Enrivea Signal — Crypto trade intelligence", template: "%s | Enrivea Signal" },
  description: "Find structured crypto trade setups, review the risk, and stay in control of execution on your exchange. An Enrivea product.",
  applicationName: "Enrivea Signal",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="min-h-screen antialiased">{children}<CookieConsent /></body></html>;
}
