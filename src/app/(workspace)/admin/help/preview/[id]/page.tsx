import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import mongoose from "mongoose";
import { workspaceActor } from "@/lib/workspace-access";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpAsset } from "@/models/HelpAsset";
import { HelpBody } from "@/components/help-body";
export const dynamic = "force-dynamic";
export default async function HelpPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await workspaceActor(); if (!actor || actor.organizationKind !== "platform" || !actor.can("help:read")) notFound();
  const { id } = await params; if (!mongoose.isValidObjectId(id)) notFound();
  const article = await HelpArticle.findOne({ _id: id, scope: actor.isDemo ? "demo" : "live", status: { $ne: "deleted" } }).lean(); if (!article) notFound();
  const images = await HelpAsset.find({ articleId: article._id, status: "active" }).lean();
  const preview = article.draft ? { ...article, ...(article.draft as object) } as typeof article : article;
  return <main className="mx-auto max-w-3xl"><div className="mb-8 rounded-xl border border-[#b88b45] bg-[#312617] p-4 text-sm text-[#ffdfa2]">Private preview · {article.draft ? "unpublished changes" : article.status} · revision {article.revision}. This page is permission-protected and not public.</div><Link href="/admin/help" className="text-sm font-bold text-accent">← Help Center editor</Link><p className="eyebrow mt-10">{preview.categorySlug}</p><h1 className="display mt-4 text-5xl">{preview.title}</h1><p className="mt-5 text-lg text-muted">{preview.summary}</p><div className="mt-10"><HelpBody body={preview.body}/></div><div className="mt-10 space-y-5">{images.map(image => <figure key={String(image._id)} className="overflow-hidden rounded-xl border border-line"><Image src={"/api/help/assets/" + String(image._id)} alt={image.alt} width={1200} height={675} unoptimized className="h-auto w-full"/>{image.caption && <figcaption className="p-3 text-xs text-muted">{image.caption}</figcaption>}</figure>)}</div></main>;
}
