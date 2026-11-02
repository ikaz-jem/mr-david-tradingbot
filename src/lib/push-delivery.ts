import "server-only";
import { Notification } from "@/models/Notification";
import { PushDevice } from "@/models/PushDevice";

// Push carries no research, account, billing, or trading details. The app reads
// notification content from its authenticated API after the user opens it.
export async function deliverPush(notificationId: string) {
  const notification = await Notification.findOneAndUpdate({ _id: notificationId, pushStatus: { $in: ["pending", "failed"] }, pushAttempts: { $lt: 5 }, $or: [{ pushLeaseUntil: null }, { pushLeaseUntil: { $lte: new Date() } }] }, { $set: { pushLeaseUntil: new Date(Date.now() + 60_000) }, $inc: { pushAttempts: 1 } }, { returnDocument: "after" });
  if (!notification) return false;
  try {
    const devices = await PushDevice.find({ userId: notification.userId, status: "active" }).select("token").lean();
    if (!devices.length) {
      await Notification.updateOne({ _id: notification._id }, { $set: { pushStatus: "skipped", pushCompletedAt: new Date(), pushLeaseUntil: null } });
      return true;
    }
    const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(devices.map(device => ({ to: device.token, title: "Enrivea Signal", body: "You have a new notification.", sound: "default", channelId: "enrivea-updates" }))), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Push provider HTTP ${response.status}`);
    const payload = await response.json() as { data?: { status: string; details?: { error?: string }; message?: string }[] };
    const results = payload.data ?? [];
    if (results.length !== devices.length) throw new Error("Incomplete push provider response");
    const invalid = results.flatMap((result, index) => result.details?.error === "DeviceNotRegistered" ? [devices[index].token] : []);
    if (invalid.length) await PushDevice.updateMany({ token: { $in: invalid } }, { $set: { status: "invalid" } });
    const failures = results.filter(result => result.status !== "ok" && result.details?.error !== "DeviceNotRegistered");
    if (failures.length) throw new Error(failures[0].message ?? "Push provider rejected delivery");
    await Notification.updateOne({ _id: notification._id }, { $set: { pushStatus: "sent", pushCompletedAt: new Date(), pushLeaseUntil: null, pushLastError: null } });
    return true;
  } catch (error) {
    await Notification.updateOne({ _id: notification._id }, { $set: { pushStatus: "failed", pushLeaseUntil: null, pushLastError: String(error).slice(0, 300) } });
    throw error;
  }
}

export async function deliverPendingPush(limit = 30) {
  const pending = await Notification.find({ pushStatus: { $in: ["pending", "failed"] }, pushAttempts: { $lt: 5 }, createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60_000) }, $or: [{ pushLeaseUntil: null }, { pushLeaseUntil: { $lte: new Date() } }] }).sort({ createdAt: 1 }).limit(limit).select("_id").lean();
  let processed = 0;
  for (let offset = 0; offset < pending.length; offset += 10) {
    const batch = await Promise.allSettled(pending.slice(offset, offset + 10).map(item => deliverPush(String(item._id))));
    batch.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) processed++;
      if (result.status === "rejected") console.error("Push delivery failed", pending[offset + index]._id, result.reason);
    });
  }
  return { attempted: pending.length, processed };
}
