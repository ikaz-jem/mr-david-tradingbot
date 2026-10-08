import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth-forms";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";
export default async function RegisterPage() { await connectDB(); const config = await getPlatformConfig(); const available = !config.maintenanceMode && config.registrationOpen; return <RegisterForm available={available} unavailableMessage={config.maintenanceMode ? config.maintenanceMessage : config.registrationPausedMessage}/>; }
