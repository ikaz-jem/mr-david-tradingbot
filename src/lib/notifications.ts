import { Notification } from "@/models/Notification";

export async function notifyUser(input: { userId: string; kind: "account" | "billing" | "research" | "exchange" | "system"; title: string; body: string; href?: string; sourceKey: string }) {
  await Notification.updateOne({ sourceKey: input.sourceKey }, { $setOnInsert: { ...input, href: input.href ?? null } }, { upsert: true });
}
