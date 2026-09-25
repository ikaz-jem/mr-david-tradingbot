import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/account-email-forms";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  const { token, email } = await searchParams;
  return <VerifyEmailForm token={typeof token === "string" ? token : undefined} email={typeof email === "string" ? email : undefined}/>;
}
