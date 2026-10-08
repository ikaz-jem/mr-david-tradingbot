import { Notification } from "@/models/Notification";
import { User } from "@/models/User";

export async function notifyUser(input: { userId: string; kind: "account" | "billing" | "research" | "exchange" | "system"; title: string; body: string; href?: string; sourceKey: string }) {
  if (input.kind === "research" || input.kind === "billing" || input.kind === "exchange") {
    const user = await User.findById(input.userId).select("settings").lean();
    const preference = input.kind === "research" ? user?.settings?.inAppResearch : input.kind === "billing" ? user?.settings?.inAppBilling : user?.settings?.inAppExchange;
    if (preference === false) return;
  }
  await Notification.updateOne({ sourceKey: input.sourceKey }, { $setOnInsert: { ...input, href: input.href ?? null } }, { upsert: true });
}
