import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
export const metadata: Metadata = { title: "Privacy policy" };
export default function Page() { return <LegalDocument title="Privacy policy" intro="This draft explains the data categories the product is expected to handle. The final policy will identify the controller, processors, retention periods, and rights for each launch jurisdiction." sections={[
  { title: "Data used to operate the service", paragraphs: ["The service may process account identity, country, login records, subscription and credit events, scan requests, signal history, connected exchange account data, order status, and support messages."] },
  { title: "Exchange credentials", paragraphs: ["Binance Spot API keys and secrets are encrypted server-side before database storage. This preview accepts read-only keys for account data; trading, withdrawal, and transfer permissions are rejected. Disconnecting removes the stored credentials. A future order feature would require a separate release and updated terms."] },
  { title: "AI and analytics", paragraphs: ["Market data and bounded research inputs may be sent to an AI provider. The product should avoid sending exchange secrets or unnecessary personal data to AI models. Essential operational telemetry is used to keep the service reliable."] },
  { title: "Your choices and rights", paragraphs: ["You can withdraw optional cookie consent and request help with account data through our contact page. Specific access, deletion, and portability rights depend on applicable law and will be detailed in the final policy."] },
]} />; }
