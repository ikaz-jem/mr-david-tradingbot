import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { demoLoginEnabled, getOrCreateDemoUser } from "@/lib/demo";
import { resolveEffectivePermissions, writeSecurityAudit } from "@/lib/access-control";
import { UserSession } from "@/models/UserSession";

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
        await User.updateOne({ _id: demo.id }, { $set: { lastActivityAt: new Date() } });
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
      user.lastActivityAt = new Date();
      await user.save();
      return { id: user._id.toString(), email: user.email, name: user.name, role: user.role, authVersion: user.authVersion, isDemo: false, mustChangePassword: user.mustChangePassword };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id; token.role = user.role ?? "user"; token.authVersion = user.authVersion ?? 0; token.isDemo = user.isDemo ?? false; token.mustChangePassword = user.mustChangePassword ?? false; token.sessionId = randomUUID();
        const access = await resolveEffectivePermissions(user.id);
        token.organizationId = access?.organizationId;
        token.permissions = access?.permissions ?? [];
        token.permissionsCheckedAt = Date.now();
        await UserSession.create({ organizationId: access?.organizationId || null, userId: user.id, sessionId: token.sessionId, status: "active", lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000) });
        return token;
      }
      if (!token.sub) return token;
      await connectDB();
      const [current, trackedSession] = await Promise.all([
        User.findById(token.sub).select("name status emailVerifiedAt authVersion role isDemo mustChangePassword organizationId").lean(),
        token.sessionId ? UserSession.findOne({ sessionId: token.sessionId }).select("status expiresAt lastSeenAt").lean() : null,
      ]);
      if (!current || current.status !== "active" || !current.emailVerifiedAt || current.authVersion !== token.authVersion || (current.isDemo && !demoLoginEnabled()) || (trackedSession && (trackedSession.status !== "active" || trackedSession.expiresAt <= new Date()))) return {};
      token.role = current.role;
      token.name = current.name;
      token.isDemo = current.isDemo;
      token.mustChangePassword = current.mustChangePassword;
      token.organizationId = current.organizationId ? String(current.organizationId) : undefined;
      if (!token.permissionsCheckedAt || Date.now() - token.permissionsCheckedAt > 60_000) {
        const access = await resolveEffectivePermissions(token.sub);
        token.permissions = access?.permissions ?? [];
        token.organizationId = access?.organizationId;
        token.permissionsCheckedAt = Date.now();
      }
      if (token.sessionId && (!trackedSession || Date.now() - new Date(trackedSession.lastSeenAt).getTime() > 5 * 60_000)) {
        await UserSession.updateOne({ sessionId: token.sessionId }, { $set: { organizationId: token.organizationId || null, userId: token.sub, status: "active", lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000) } }, { upsert: true });
        await User.updateOne({ _id: token.sub }, { $set: { lastActivityAt: new Date() } });
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) return { ...session, user: undefined };
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "user";
        session.user.isDemo = token.isDemo ?? false;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
        session.user.organizationId = token.organizationId;
        session.user.permissions = token.permissions ?? [];
        session.user.sessionId = token.sessionId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) { await writeSecurityAudit({ actor: { id: user.id, organizationId: user.organizationId }, action: "authentication.login", resource: "sessions", targetType: "user", targetId: user.id, outcome: "success", reason: "Credentials accepted" }).catch(() => undefined); },
    async signOut({ token }) { if (token.sessionId) await UserSession.updateOne({ sessionId: token.sessionId }, { $set: { status: "revoked", revokedAt: new Date() } }); await writeSecurityAudit({ actor: { id: token.sub, organizationId: token.organizationId }, action: "authentication.logout", resource: "sessions", targetType: "session", targetId: token.sessionId ?? "", outcome: "success", reason: "User signed out" }).catch(() => undefined); },
  },
};
