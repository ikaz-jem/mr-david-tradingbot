import { DemoEmail } from "@/models/DemoEmail";
import { PageIntro } from "@/components/dashboard-ui";
import { AdminEmailTestButton } from "@/components/admin-email-test-button";
export async function DemoEmailOperations() {
  const messages = await DemoEmail.find().sort({ createdAt: -1 }).limit(50).lean();
  return <><PageIntro eyebrow="Demo / communication" title="Email outbox" description="Test the email workflow without contacting Resend or sending external mail. Sample messages persist across reloads."/><section className="surface rounded-2xl p-6"><h2 className="mb-4 text-lg font-bold">Delivery test</h2><AdminEmailTestButton/><div className="mt-6 divide-y divide-line">{messages.map(message => <article key={String(message._id)} className="flex flex-wrap justify-between gap-3 py-4 text-sm"><div><p className="font-bold">{message.subject}</p><p className="mt-1 text-xs text-muted">{message.recipient} · {message.category}</p></div><div className="text-right"><span className="text-accent">Simulated · not sent</span><p className="mt-1 text-xs text-muted">{message.createdAt.toLocaleString()}</p></div></article>)}{!messages.length && <p className="text-sm text-muted">Send a test to create your first sample message.</p>}</div></section></>;
}
