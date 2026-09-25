import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account-email-forms";

export const metadata: Metadata = { title: "Choose new password", robots: { index: false, follow: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : undefined}/>;
}
