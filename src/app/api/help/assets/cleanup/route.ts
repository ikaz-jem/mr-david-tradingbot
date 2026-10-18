import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { writeSecurityAudit } from "@/lib/access-control";
import { deleteHelpImage } from "@/lib/help-r2";
import { HelpAsset } from "@/models/HelpAsset";
import { HelpArticle } from "@/models/HelpArticle";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "platform" || !actor.can("help:delete")) return NextResponse.json({ error: "Help Center delete permission required." }, { status: 403 });
  const scope = actor.isDemo ? "demo" : "live";
  const articles = await HelpArticle.find({ scope }).select("_id").lean();
  const pending = await HelpAsset.find({ articleId: { $in: articles.map(article => article._id) }, $or: [{ status: "deletion_pending" }, { status: "upload_pending", createdAt: { $lt: new Date(Date.now() - 10 * 60_000) } }] }).limit(25);
  let cleaned = 0;
  for (const asset of pending) { try { await deleteHelpImage(asset.key, Boolean(actor.isDemo)); await asset.deleteOne(); cleaned++; } catch { /* Retain pending record for another retry. */ } }
  await writeSecurityAudit({ actor, action: "help.asset.cleanup", resource: "help", targetType: "asset", newValue: { attempted: pending.length, cleaned }, outcome: "success", request });
  return NextResponse.json({ attempted: pending.length, cleaned });
}
