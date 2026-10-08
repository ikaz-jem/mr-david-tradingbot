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
if (!process.env.ALLOWED_COUNTRIES?.trim()) warnings.push("ALLOWED_COUNTRIES is empty; global access policy is not restricted");
if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) warnings.push("Resend environment fallback is not configured; verify encrypted admin service configuration before opening registration");
if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) warnings.push("OpenAI environment fallback is not configured; verify encrypted admin service configuration before enabling scans");

if (process.env.BILLING_LIVE_ENABLED === "true") {
  for (const name of ["PAYSTACK_LIVE_SECRET_KEY", "PAYSTACK_CURRENCY", "PAYSTACK_ALLOWED_COUNTRIES"]) required(name);
  if (process.env.PAYSTACK_WEBHOOK_CONFIRMED !== "true") errors.push("PAYSTACK_WEBHOOK_CONFIRMED must be true when live billing is enabled");
  if (process.env.PAYSTACK_MERCHANT_APPROVED !== "true") errors.push("PAYSTACK_MERCHANT_APPROVED must be true when live billing is enabled");
}

console.log(`Production readiness: ${errors.length} error(s), ${warnings.length} warning(s)`);
for (const message of errors) console.error(`ERROR: ${message}`);
for (const message of warnings) console.warn(`WARN: ${message}`);
if (errors.length) process.exitCode = 1;
