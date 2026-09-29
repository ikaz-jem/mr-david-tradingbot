import { PageIntro } from "@/components/dashboard-ui";
import { SupportInbox } from "@/components/support-inbox";
export default function SupportPage() {
  return <><PageIntro eyebrow="Operations" title="Support inbox" description="Triage customer requests, assign ownership, and resolve issues. Internal notes never appear in the customer inbox."/><SupportInbox staff/></>;
}

