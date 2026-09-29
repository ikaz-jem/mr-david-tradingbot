import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageIntro } from "@/components/dashboard-ui";
import { ProductCatalogEditor } from "@/components/product-catalog-editor";
export default async function ProductsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") redirect("/dashboard");
  return <><PageIntro eyebrow="Commerce & entitlements" title="Product catalog" description="One membership, separate product balances. Configure consumption, monthly credit allocations, and top-up packages."/><ProductCatalogEditor/></>;
}

