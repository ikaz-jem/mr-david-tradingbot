import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { isSameOrigin } from "@/lib/request-origin";
import { connectDB } from "@/lib/db";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpCategory } from "@/models/HelpCategory";
import { HelpFeedback } from "@/models/HelpFeedback";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const data = await request.json().catch(() => null);
  if (!mongoose.isValidObjectId(data?.articleId) || typeof data?.helpful !== "boolean") return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  await connectDB();
  const article = await HelpArticle.findOne({ _id: data.articleId, scope: "live", status: "published" }).select("categorySlug").lean();
  if (!article || !await HelpCategory.exists({ scope: "live", slug: article.categorySlug, status: "active" })) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  const identity = [request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown", request.headers.get("user-agent") || "unknown", day].join("|");
  const secret = process.env.HELP_FEEDBACK_SALT || process.env.NEXTAUTH_SECRET || "help-feedback";
  const visitorKey = createHash("sha256").update(secret + identity).digest("hex");
  const count = await HelpFeedback.countDocuments({ visitorKey });
  if (count >= 20 && !await HelpFeedback.exists({ visitorKey, articleId: article._id })) return NextResponse.json({ error: "Feedback limit reached for today." }, { status: 429 });
  await HelpFeedback.updateOne({ visitorKey, articleId: article._id }, { $set: { helpful: data.helpful, expiresAt: new Date(Date.now() + 90 * 86400000) } }, { upsert: true });
  return NextResponse.json({ ok: true });
}
