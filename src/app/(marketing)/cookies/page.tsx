import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
export const metadata: Metadata = { title: "Cookie policy" };
export default function Page() { return <LegalDocument title="Cookie policy" intro="This prototype stores a preference for essential versus optional cookies. Optional analytics are not installed in the current build." sections={[
  { title: "Essential storage", paragraphs: ["Authentication and security features may use strictly necessary cookies. The cookie banner also saves your selection in local browser storage."] },
  { title: "Optional analytics", paragraphs: ["If analytics is introduced, it will remain off unless your choice and applicable law allow it. The final policy will identify each provider, purpose, and retention period."] },
  { title: "Change your choice", paragraphs: ["You can clear this site's local storage to see the banner again. A dedicated preferences control will be added before optional tracking is enabled."] },
]} />; }
