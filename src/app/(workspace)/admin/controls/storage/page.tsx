import { notFound } from "next/navigation";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { R2StorageControls } from "@/components/r2-storage-controls";
import { workspaceActor } from "@/lib/workspace-access";
import { completeR2Settings, deploymentR2Settings } from "@/lib/help-r2";
import { serviceEncryptionReady } from "@/lib/service-config";
import { ServiceConfig } from "@/models/ServiceConfig";

export const dynamic = "force-dynamic";
export default async function StorageControlsPage() {
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "platform" || !actor.can("settings:read")) notFound();
  const saved = await ServiceConfig.findOne({ key: actor.isDemo ? "demo" : "global" }).lean();
  const dashboard = Boolean(saved?.r2AccountId && saved?.r2BucketName && saved?.r2AccessKeyIdEncrypted && saved?.r2SecretAccessKeyEncrypted);
  const deployment = deploymentR2Settings();
  const initial = { accountId: dashboard ? saved!.r2AccountId : deployment.accountId, bucketName: dashboard ? saved!.r2BucketName : deployment.bucketName, configured: dashboard || completeR2Settings(deployment), source: dashboard ? "dashboard" as const : completeR2Settings(deployment) ? "deployment" as const : "unset" as const, encryptionReady: serviceEncryptionReady(), demo: Boolean(actor.isDemo) };
  return <><PageIntro eyebrow="Platform controls / storage" title="Image storage" description="Connect a private Cloudflare R2 bucket for Help Center screenshots and editorial images."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Cloudflare R2" detail="Private bucket · encrypted credentials · verified connection"/><R2StorageControls initial={initial} canUpdate={actor.can("settings:update")}/></section></>;
}
