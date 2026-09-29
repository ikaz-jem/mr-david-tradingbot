import "server-only";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { User } from "@/models/User";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
export async function ensureDemoCustomers() {
  const fixtures = [
    { name: "Amara Okafor", email: "sample-amara@enrivea.invalid", role: "user", status: "active", countryCode: "NG" },
    { name: "James Carter", email: "sample-james@enrivea.invalid", role: "user", status: "suspended", countryCode: "GB" },
    { name: "Leila Hassan", email: "sample-leila@enrivea.invalid", role: "user", status: "banned", countryCode: "AE" },
    { name: "Daniel Mensah", email: "sample-daniel@enrivea.invalid", role: "staff", status: "active", countryCode: "GH" },
  ] as const;
  for (const fixture of fixtures) {
    let user = await User.findOne({ email: fixture.email, isDemo: true });
    if (!user) {
      if (await User.exists({ email: fixture.email })) continue;
      try { user = await User.create({ ...fixture, isDemo: true, emailVerifiedAt: new Date(), passwordHash: await hash(randomBytes(32).toString("hex"), 12) }); }
      catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error; user = await User.findOne({ email: fixture.email, isDemo: true }); }
    }
    if (user) await ensureDemoWorkspace(String(user._id));
  }
}
