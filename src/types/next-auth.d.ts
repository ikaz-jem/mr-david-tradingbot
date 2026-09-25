import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User { role?: "user" | "staff" | "admin"; authVersion?: number; isDemo?: boolean; }
  interface Session { user: { id: string; role: "user" | "staff" | "admin"; isDemo?: boolean; name?: string | null; email?: string | null; image?: string | null } }
}

declare module "next-auth/jwt" {
  interface JWT { role?: "user" | "staff" | "admin"; authVersion?: number; isDemo?: boolean; }
}
