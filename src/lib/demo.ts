import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { User } from "@/models/User";
import { seedDemoResearch } from "@/lib/demo-workspace";

import { demoLoginEnabled } from "@/lib/demo-policy";
import { ensureDemoCustomers } from "@/lib/demo-customers";
export { demoLoginEnabled } from "@/lib/demo-policy";

export async function getOrCreateDemoUser(role: "user" | "admin") {
  if (!demoLoginEnabled()) return null;
  const email = `demo-${role}@enrivea.invalid`;
  const name = role === "admin" ? "Enrivea Demo Admin" : "Enrivea Demo User";
  let user = await User.findOne({ email });
  if (user && !user.isDemo) return null;
  if (!user) {
    try {
      user = await User.create({ name, email, passwordHash: await hash(randomBytes(32).toString("hex"), 12), role, isDemo: true, emailVerifiedAt: new Date() });
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && error.code === 11000)) throw error;
      user = await User.findOne({ email, isDemo: true });
    }
  }
  if (!user) return null;
  if (user.role !== role || user.status !== "active" || !user.emailVerifiedAt) {
    user = await User.findOneAndUpdate({ _id: user._id, isDemo: true }, { $set: { role, status: "active", emailVerifiedAt: new Date() } }, { new: true });
  }
  if (!user) return null;
  await seedDemoResearch(user.id, user.name);
  if (role === "admin") await ensureDemoCustomers();
  return user;
}
