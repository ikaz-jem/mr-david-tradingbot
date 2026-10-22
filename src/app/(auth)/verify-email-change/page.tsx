import type { Metadata } from "next";
import { EmailChangeConfirmation } from "@/components/email-change-form";
export const metadata: Metadata = { title: "Confirm email change", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <EmailChangeConfirmation token={typeof token === "string" ? token : undefined}/>;
}
