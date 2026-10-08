import assert from "node:assert/strict";
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
const database = `enrivea_approval_test_${Date.now()}`;
await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 15000 });
const realFetch = globalThis.fetch;
try {
  process.env.OPENAI_API_KEY = "isolated-fixture-key";
  process.env.OPENAI_MODEL = "isolated-fixture-model";
  const { User } = await import("../src/models/User.ts");
  const { ApprovalPreference } = await import("../src/models/ApprovalPreference.ts");
  const { ApprovalScanJob } = await import("../src/models/ApprovalScanJob.ts");
  const { SharedOpportunity } = await import("../src/models/SharedOpportunity.ts");
  const { ResearchCache } = await import("../src/models/ResearchCache.ts");
  const { ProductDefinition } = await import("../src/models/ProductDefinition.ts");
  const { getProductCatalog } = await import("../src/lib/product-catalog.ts");
  const { runApprovalDiscovery } = await import("../src/lib/approval-engine.ts");
  await Promise.all([ApprovalScanJob.init(), SharedOpportunity.init(), ResearchCache.init()]);
  await getProductCatalog(false);
  await ProductDefinition.updateOne({ scope: "live", slug: "approval-desk" }, { $set: { enabled: true } });
  await mongoose.connection.db.collection("platformconfigs").insertOne({ key: "global", approvalScanSymbols: ["BTCUSDT"], approvalScanIntervals: ["4h"], approvalScanStrategySlugs: ["trend-breakout"], approvalScanCadenceMinutes: 5 });
  for (const index of [1, 2]) {
    const user = await User.create({ name: "Approval test", email: `approval-${index}@example.invalid`, passwordHash: "not-a-login-hash", status: "active", isDemo: false, activatedAt: new Date(), creditBalance: 10 });
    await ApprovalPreference.create({ userId: user._id, symbols: ["BTCUSDT"], intervals: ["4h"], strategySlugs: ["trend-breakout"] });
  }
  let marketRequests = 0, aiRequests = 0, rejectAi = false;
  globalThis.fetch = async url => {
    if (String(url).includes("/api/v3/klines")) {
      marketRequests++;
      const interval = 14400000, cutoff = Math.floor(Date.now() / interval) * interval;
      const rows = Array.from({ length: 100 }, (_, index) => [cutoff - (100 - index) * interval, 100 + index * .1, index === 99 ? 115 : 101 + index * .1, 99 + index * .1, index === 99 ? 114 : 100 + index * .1, index === 99 ? 200 : 100, cutoff - (99 - index) * interval - 1]);
      return Response.json(rows);
    }
    if (String(url) === "https://api.openai.com/v1/responses") {
      aiRequests++;
      if (rejectAi) return Response.json({ error: "fixture credential rejection" }, { status: 401 });
      return Response.json({ id: "fixture-response", status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ decision: "publish", confidence: 80, summary: "Fixture breakout evidence supports a bounded long candidate.", thesis: "Fixture closed candles show aligned trend and volume confirmation.", riskNote: "This fixture is invalid if the defined protective stop is crossed." }) }] }] });
    }
    throw new Error("Unexpected external request in isolated test");
  };
  const first = await runApprovalDiscovery();
  assert.equal(first.combinations, 1, "Two users must share one combination");
  assert.equal(first.opportunitiesCreated, 1);
  const second = await runApprovalDiscovery();
  assert.equal(second.skippedByCadence, true);
  await ApprovalScanJob.updateOne({ key: "approval-discovery:live" }, { $set: { completedAt: new Date(0) } });
  const third = await runApprovalDiscovery();
  assert.equal(third.opportunitiesCreated, 0);
  assert.equal(marketRequests, 1, "Candles must be shared from the database cache");
  assert.equal(aiRequests, 1, "AI result must be shared from the database cache");
  assert.equal(await SharedOpportunity.countDocuments(), 1);
  assert.equal(await User.countDocuments({ creditBalance: 10 }), 2, "Discovery never spends user credits");
  await ResearchCache.deleteMany({});
  await ApprovalScanJob.updateOne({ key: "approval-discovery:live" }, { $set: { completedAt: new Date(0) } });
  rejectAi = true;
  await assert.rejects(runApprovalDiscovery(), /AI credential rejected/);
  assert.equal((await ApprovalScanJob.findOne()).status, "failed");
  console.log("PASS: shared discovery, no scan credit charge, cadence, database candle/AI cache, publication deduplication, and credential-failure reporting.");
} finally {
  globalThis.fetch = realFetch;
  if (mongoose.connection.name !== database || !/^enrivea_approval_test_\d+$/.test(database)) throw new Error("Unexpected test database; refusing cleanup");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
