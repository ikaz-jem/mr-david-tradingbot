import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { ensureWelcomeCredits } from "@/lib/credits";
import { User } from "@/models/User";

export function demoLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEMO_LOGIN_ENABLED === "true";
}

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
  await ensureWelcomeCredits(user.id);
  return user;
}
