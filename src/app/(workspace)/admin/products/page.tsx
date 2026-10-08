import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { PageIntro } from "@/components/dashboard-ui";
import { ProductCatalogEditor } from "@/components/product-catalog-editor";
export default async function ProductsPage() {
  const actor = await workspaceActor();
  if (!actor?.can("products:read")) notFound();
  return <><PageIntro eyebrow="Commerce & entitlements" title="Product catalog" description="Configure every platform product and the number of shared credits each successful action consumes."/><ProductCatalogEditor/></>;
}

