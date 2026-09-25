import { Resend } from "resend";
import { EmailDelivery } from "@/models/EmailDelivery";

export function hasEmailProvider() { return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.APP_URL); }

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function frame(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b110d;font-family:Arial,sans-serif;color:#f5f8f1"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><div style="font-size:20px;font-weight:800;letter-spacing:-.04em">enrivea<span style="color:#c5ff41">/</span>signal</div><div style="margin-top:28px;border:1px solid #344437;border-radius:18px;background:#141d16;padding:32px"><h1 style="margin:0;font-size:27px;line-height:1.2">${title}</h1>${body}</div><p style="margin:25px 0 0;color:#9ead9d;font-size:12px;line-height:1.6">Enrivea Signal is a product of Enrivea. Crypto research does not guarantee returns. If you did not request this email, you can ignore it.</p></div></body></html>`;
}

export function verificationEmail(name: string, url: string) {
  const safeName = escapeEmailHtml(name);
  const safeUrl = escapeEmailHtml(url);
  return { subject: "Verify your Enrivea Signal email", html: frame("Confirm your email", `<p style="color:#cbd9ca;line-height:1.7">Hi ${safeName}, confirm your email address to activate your research workspace.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#c5ff41;color:#101810;padding:14px 19px;border-radius:10px;font-weight:800;text-decoration:none">Verify email</a></p><p style="color:#9ead9d;font-size:13px;line-height:1.6">This link expires in 24 hours. If the button does not work, open this URL: ${safeUrl}</p>`), text: `Hi ${name}, verify your Enrivea Signal email within 24 hours: ${url}` };
}

export function passwordResetEmail(name: string, url: string) {
  const safeName = escapeEmailHtml(name);
  const safeUrl = escapeEmailHtml(url);
  return { subject: "Reset your Enrivea Signal password", html: frame("Reset your password", `<p style="color:#cbd9ca;line-height:1.7">Hi ${safeName}, use this link to set a new password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#c5ff41;color:#101810;padding:14px 19px;border-radius:10px;font-weight:800;text-decoration:none">Reset password</a></p><p style="color:#9ead9d;font-size:13px;line-height:1.6">This link expires in 30 minutes. If you did not request it, your password has not changed. Link: ${safeUrl}</p>`), text: `Hi ${name}, reset your Enrivea Signal password within 30 minutes: ${url}` };
}

export function welcomeEmail(name: string) {
  const safeName = escapeEmailHtml(name);
  return { subject: "Your Enrivea Signal workspace is ready", html: frame("Welcome to clearer research", `<p style="color:#cbd9ca;line-height:1.7">Hi ${safeName}, your workspace is ready. Start by exploring the research desk and your five welcome analysis credits.</p><p style="color:#9ead9d;font-size:13px;line-height:1.6">Exchange execution and paid access remain disabled during this preview.</p>`), text: `Hi ${name}, your Enrivea Signal workspace is ready. You have five welcome analysis credits.` };
}

export function passwordChangedEmail(name: string) {
  const safeName = escapeEmailHtml(name);
  return { subject: "Your Enrivea Signal password changed", html: frame("Password updated", `<p style="color:#cbd9ca;line-height:1.7">Hi ${safeName}, the password for your Enrivea Signal account was changed. Existing sessions have been invalidated. If this was not you, contact us immediately at contact@enrivea.com.</p>`), text: `Hi ${name}, your Enrivea Signal password was changed. Existing sessions have been invalidated. If this was not you, contact contact@enrivea.com immediately.` };
}

export async function sendEmail(input: { to: string; category: string; eventKey: string; subject: string; html: string; text: string; replyTo?: string }) {
  if (!hasEmailProvider()) throw new Error("Resend is not configured");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { data, error } = await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL!, to: input.to, subject: input.subject, html: input.html, text: input.text, replyTo: input.replyTo }, { idempotencyKey: input.eventKey });
  if (error || !data?.id) {
    await EmailDelivery.updateOne({ eventKey: input.eventKey }, { $set: { recipient: input.to, category: input.category, status: "failed", lastError: error?.message ?? "Provider returned no email ID" } }, { upsert: true }).catch(recordError => console.error("Email failure record unavailable", recordError));
    throw new Error(error?.message ?? "Email delivery was not accepted");
  }
  await EmailDelivery.updateOne({ eventKey: input.eventKey }, { $set: { recipient: input.to, category: input.category, providerId: data.id, status: "sent", lastError: "" } }, { upsert: true }).catch(recordError => console.error("Email delivery record unavailable", recordError));
  return data.id;
}
