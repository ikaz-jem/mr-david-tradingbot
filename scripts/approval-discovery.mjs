// Trusted operator CLI. No credentials or user details are printed.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import mongoose from "mongoose";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return nextResolve("next/dist/compiled/server-only/empty.js", context);
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.join(root, "src", `${specifier.slice(2)}.ts`)).href, context);
  return nextResolve(specifier, context);
} });
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  const db = mongoose.connection.db;
  const product = await db.collection("productdefinitions").findOne({ scope: "live", slug: "approval-desk" }, { projection: { enabled: 1, cost: 1, revision: 1 } });
  const operations = await db.collection("platformconfigs").findOne({ key: "global" }, { projection: { _id: 0, maintenanceMode: 1, scansOpen: 1, approvalDiscoveryOpen: 1, approvalScanSymbols: 1, approvalScanIntervals: 1, approvalScanStrategySlugs: 1 } });
  const preferences = await db.collection("approvalpreferences").find({ enabled: true }).toArray();
  const eligible = await db.collection("users").countDocuments({ _id: { $in: preferences.map(row => row.userId) }, isDemo: false, status: "active", activatedAt: { $ne: null } });
  console.log(JSON.stringify({ product, operations, eligibleUsers: eligible, cronSecretConfigured: Boolean(process.env.CRON_SECRET) }));
  if (process.env.APPROVAL_ENABLE_PRODUCT === "true" && product && !product.enabled) {
    await mongoose.connection.transaction(async session => {
      await db.collection("productdefinitions").updateOne({ _id: product._id, enabled: false }, { $set: { enabled: true, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      await db.collection("authorizationauditlogs").insertOne({ action: "products:update", resource: "products", targetType: "ProductDefinition", targetId: String(product._id), previousValue: { enabled: false }, newValue: { enabled: true }, outcome: "success", reason: "Owner requested operational Approval Desk and first live discovery run", metadata: { source: "trusted-operator-cli" }, createdAt: new Date() }, { session });
    });
    console.log("Approval Desk live product enabled; configured credit cost preserved.");
  }
  if (process.env.APPROVAL_RUN === "true") {
    const { runApprovalDiscovery } = await import("../src/lib/approval-engine.ts");
    do {
      try { console.log(JSON.stringify(await runApprovalDiscovery())); }
      catch (error) { console.error(error instanceof Error ? error.message : "Discovery failed"); if (process.env.APPROVAL_WATCH !== "true") process.exitCode = 1; }
      if (process.env.APPROVAL_WATCH === "true") await new Promise(resolve => setTimeout(resolve, 300000));
    } while (process.env.APPROVAL_WATCH === "true");
  }
  const job = await db.collection("approvalscanjobs").findOne({ key: "approval-discovery:live" }, { projection: { _id: 0, status: 1, combinations: 1, opportunitiesCreated: 1, completedAt: 1, lastError: 1, outcomes: 1 } });
  console.log(JSON.stringify({ job }));
} finally { await mongoose.disconnect(); }
