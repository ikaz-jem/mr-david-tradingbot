import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { demoLoginEnabled, getOrCreateDemoUser } from "@/lib/demo";

const credentialsSchema = z.object({ email: z.email().max(254), password: z.string().min(1) });

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Email and password",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" }, demoRole: { label: "Demo role", type: "text" } },
    async authorize(credentials) {
      if (demoLoginEnabled() && (credentials?.demoRole === "user" || credentials?.demoRole === "admin")) {
        await connectDB();
        const demo = await getOrCreateDemoUser(credentials.demoRole);
        if (!demo) return null;
        return { id: demo.id, email: demo.email, name: demo.name, role: demo.role, authVersion: demo.authVersion, isDemo: true, mustChangePassword: false };
      }
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;
      await connectDB();
      const email = parsed.data.email.toLowerCase();
      const windowStart = Math.floor(Date.now() / (15 * 60_000));
      const emailKey = createHash("sha256").update(email).digest("hex");
      const attemptKey = `login:${emailKey}:${windowStart}`;
      const attempts = await SecurityAttempt.findOne({ key: attemptKey }).lean();
      if (attempts && attempts.count >= 10) return null;
      const user = await User.findOne({ email, status: "active" }).select("+passwordHash");
      const valid = Boolean(user && !user.isDemo && user.emailVerifiedAt && await compare(parsed.data.password, user.passwordHash));
      if (!valid || !user) {
        await SecurityAttempt.updateOne(
          { key: attemptKey },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowStart + 2) * 15 * 60_000) } },
          { upsert: true },
        );
        return null;
      }
      await SecurityAttempt.deleteOne({ key: attemptKey });
      return { id: user._id.toString(), email: user.email, name: user.name, role: user.role, authVersion: user.authVersion, isDemo: false, mustChangePassword: user.mustChangePassword };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.role = user.role ?? "user"; token.authVersion = user.authVersion ?? 0; token.isDemo = user.isDemo ?? false; token.mustChangePassword = user.mustChangePassword ?? false; return token; }
      if (!token.sub) return token;
      await connectDB();
      const current = await User.findById(token.sub).select("name status emailVerifiedAt authVersion role isDemo mustChangePassword").lean();
      if (!current || current.status !== "active" || !current.emailVerifiedAt || current.authVersion !== token.authVersion || (current.isDemo && !demoLoginEnabled())) return {};
      token.role = current.role;
      token.name = current.name;
      token.isDemo = current.isDemo;
      token.mustChangePassword = current.mustChangePassword;
      return token;
    },
    async session({ session, token }) { if (session.user && token.sub) { session.user.id = token.sub; session.user.role = token.role ?? "user"; session.user.isDemo = token.isDemo ?? false; session.user.mustChangePassword = token.mustChangePassword ?? false; } return session; },
  },
};
