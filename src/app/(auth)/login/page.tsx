import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { demoLoginEnabled } from "@/lib/demo";
export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() { return <LoginForm demoEnabled={demoLoginEnabled()}/>; }
