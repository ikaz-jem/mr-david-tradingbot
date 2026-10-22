import { existsSync, readFileSync } from "node:fs";

const errors = [];
const warnings = [];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is missing`);
  return value;
}

function httpsUrl(name) {
  const value = required(name);
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${name} must use HTTPS`);
    if (["localhost", "127.0.0.1"].includes(url.hostname)) errors.push(`${name} must not point to localhost`);
  } catch {
    errors.push(`${name} is not a valid URL`);
  }
}

const mongo = required("MONGODB_URI");
if (mongo && /(?:localhost|127\.0\.0\.1)/i.test(mongo)) errors.push("MONGODB_URI must use a managed production database");
const authSecret = required("NEXTAUTH_SECRET");
if (authSecret && (authSecret.length < 32 || /replace|example|secret/i.test(authSecret))) errors.push("NEXTAUTH_SECRET must be a unique random value of at least 32 characters");
const serviceEncryptionKey = process.env.SERVICE_CONFIG_ENCRYPTION_KEY?.trim();
if (!serviceEncryptionKey) warnings.push("SERVICE_CONFIG_ENCRYPTION_KEY is missing; new dashboard-managed provider credentials will remain coupled to NEXTAUTH_SECRET");
else if (Buffer.from(serviceEncryptionKey, "base64").length !== 32) errors.push("SERVICE_CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes");
httpsUrl("NEXTAUTH_URL");
httpsUrl("APP_URL");
if (process.env.NEXTAUTH_URL && process.env.APP_URL && process.env.NEXTAUTH_URL.replace(/\/$/, "") !== process.env.APP_URL.replace(/\/$/, "")) warnings.push("NEXTAUTH_URL and APP_URL use different origins");
const cronSecret = required("CRON_SECRET");
if (cronSecret && (cronSecret.length < 16 || /replace|example|scheduler-secret/i.test(cronSecret))) errors.push("CRON_SECRET must be a unique random value of at least 16 characters");

const encryptionKey = required("EXCHANGE_ENCRYPTION_KEY");
if (encryptionKey) {
  try {
    if (Buffer.from(encryptionKey, "base64").length !== 32) errors.push("EXCHANGE_ENCRYPTION_KEY must decode to exactly 32 bytes");
  } catch {
    errors.push("EXCHANGE_ENCRYPTION_KEY must be valid base64");
  }
}
const allowedCountries = (process.env.ALLOWED_COUNTRIES ?? "").split(",").map(value => value.trim()).filter(Boolean);
const blockedCountries = (process.env.BLOCKED_COUNTRIES ?? "").split(",").map(value => value.trim()).filter(Boolean);
if (!allowedCountries.length) errors.push("ALLOWED_COUNTRIES is required; live billing and exchange operations fail closed without it");
if ([...allowedCountries, ...blockedCountries].some(value => !/^[A-Z]{2}$/i.test(value))) errors.push("ALLOWED_COUNTRIES and BLOCKED_COUNTRIES must contain comma-separated two-letter country codes");
if (allowedCountries.some(value => blockedCountries.some(blocked => blocked.toUpperCase() === value.toUpperCase()))) errors.push("A country cannot appear in both ALLOWED_COUNTRIES and BLOCKED_COUNTRIES");
if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) warnings.push("Resend environment fallback is not configured; verify encrypted admin service configuration before opening registration");
if ((process.env.RESEND_API_KEY || process.env.RESEND_FROM_EMAIL) && !process.env.RESEND_WEBHOOK_SECRET) warnings.push("RESEND_WEBHOOK_SECRET is missing; delivery, bounce, and complaint reconciliation is incomplete");
if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) warnings.push("OpenAI environment fallback is not configured; verify encrypted admin service configuration before enabling scans");

if (!existsSync("vercel.json")) errors.push("vercel.json is missing; scheduled discovery and Autopilot will not deploy");
else {
  try {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    if (!Array.isArray(vercel.crons) || !vercel.crons.some(job => job.path === "/api/internal/approval-scan")) errors.push("vercel.json does not schedule /api/internal/approval-scan");
    if (!Array.isArray(vercel.crons) || !vercel.crons.some(job => job.path === "/api/internal/autopilot")) errors.push("vercel.json does not schedule /api/internal/autopilot");
    if (!Array.isArray(vercel.crons) || !vercel.crons.some(job => job.path === "/api/internal/trade-tracking")) errors.push("vercel.json does not schedule /api/internal/trade-tracking");
    for (const path of ["/api/internal/billing-reconciliation", "/api/internal/help-assets"]) {
      if (!vercel.crons?.some(job => job.path === path)) errors.push(`vercel.json does not schedule ${path}`);
    }
  } catch { errors.push("vercel.json is not valid JSON"); }
}

if (process.env.EXCHANGE_EXECUTION_CERTIFIED !== "true") warnings.push("EXCHANGE_EXECUTION_CERTIFIED is not true; live Approval Desk and Autopilot execution remain safely locked until staging certification is complete");
warnings.push("The configured minute-level Vercel Cron schedules require a plan that supports more than daily jobs; otherwise use an authenticated external scheduler");

if (process.env.BILLING_LIVE_ENABLED === "true") {
  if (process.env.PAYSTACK_WEBHOOK_CONFIRMED !== "true") errors.push("PAYSTACK_WEBHOOK_CONFIRMED must be true when live billing is enabled");
  if (process.env.PAYSTACK_MERCHANT_APPROVED !== "true") errors.push("PAYSTACK_MERCHANT_APPROVED must be true when live billing is enabled");
  warnings.push("Verify the live Paystack key, settlement currency and rate in admin payment controls; this offline check cannot inspect encrypted dashboard settings or prove webhook delivery");
}

console.log(`Production readiness: ${errors.length} error(s), ${warnings.length} warning(s)`);
for (const message of errors) console.error(`ERROR: ${message}`);
for (const message of warnings) console.warn(`WARN: ${message}`);
if (errors.length) process.exitCode = 1;
