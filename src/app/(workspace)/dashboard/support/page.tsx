import { PageIntro } from "@/components/dashboard-ui";
import { SupportInbox } from "@/components/support-inbox";
export default function SupportPage() {
  return <><PageIntro eyebrow="Customer care" title="Support desk" description="Track requests, reply to your support team, and reopen an issue if you still need help."/><SupportInbox/></>;
}

