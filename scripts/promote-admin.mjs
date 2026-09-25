import mongoose from "mongoose";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run make-admin -- person@example.com");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is missing from .env.local");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
try {
  const result = await mongoose.connection.collection("users").updateOne({ email }, { $set: { role: "admin" } });
  if (result.matchedCount !== 1) { console.error("No registered account matches that email."); process.exitCode = 1; }
  else console.log(`Admin role granted to ${email}. Sign out and in again to refresh the session.`);
} finally {
  await mongoose.disconnect();
}
