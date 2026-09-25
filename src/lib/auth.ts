import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
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
        return { id: demo.id, email: demo.email, name: demo.name, role: demo.role, authVersion: demo.authVersion, isDemo: true };
      }
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;
      await connectDB();
      const user = await User.findOne({ email: parsed.data.email.toLowerCase(), status: "active" }).select("+passwordHash");
      if (!user || user.isDemo || !user.emailVerifiedAt || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user._id.toString(), email: user.email, name: user.name, role: user.role, authVersion: user.authVersion, isDemo: false };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.role = user.role ?? "user"; token.authVersion = user.authVersion ?? 0; token.isDemo = user.isDemo ?? false; return token; }
      if (!token.sub) return token;
      await connectDB();
      const current = await User.findById(token.sub).select("status emailVerifiedAt authVersion role isDemo").lean();
      if (!current || current.status !== "active" || !current.emailVerifiedAt || current.authVersion !== token.authVersion || (current.isDemo && !demoLoginEnabled())) return {};
      token.role = current.role;
      token.isDemo = current.isDemo;
      return token;
    },
    async session({ session, token }) { if (session.user && token.sub) { session.user.id = token.sub; session.user.role = token.role ?? "user"; session.user.isDemo = token.isDemo ?? false; } return session; },
  },
};
