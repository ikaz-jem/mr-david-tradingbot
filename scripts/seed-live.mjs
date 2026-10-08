import { randomBytes } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import { hash } from "bcryptjs";
import mongoose from "mongoose";

const ADMIN_EMAIL = "echchebabzakariae@gmail.com";
const SEED = "enrivea-live-seed-v1";
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");

async function hiddenQuestion(prompt) {
  output.write(prompt);
  input.setRawMode?.(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = chunk => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") { input.setRawMode?.(false); reject(new Error("Cancelled.")); return; }
        if (character === "\r" || character === "\n") {
          input.setRawMode?.(false); input.pause(); input.off("data", onData); output.write("\n"); resolve(value); return;
        }
        if (character === "\b" || character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    input.on("data", onData);
  });
}

const password = await hiddenQuestion(`Temporary password for ${ADMIN_EMAIL}: `);
if (password.length < 8 || password.length > 128) throw new Error("Temporary password must be 8 to 128 characters.");

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
const db = mongoose.connection.db;
const database = mongoose.connection.name;
if (["admin", "config", "local", "test"].includes(database.toLowerCase())) throw new Error(`Refusing to seed generic database ${database}.`);
if (["localhost", "127.0.0.1"].includes(mongoose.connection.host)) throw new Error("Refusing to run the live seed against localhost.");

const now = new Date();
const days = value => new Date(now.getTime() + value * 86_400_000);
const users = db.collection("users");

try {
  const passwordHash = await hash(password, 12);
  const existingAdmin = await users.findOne({ email: ADMIN_EMAIL });
  if (existingAdmin?.isDemo) throw new Error("The requested administrator email belongs to a demo identity.");
  if (existingAdmin) {
    await users.updateOne({ _id: existingAdmin._id }, { $set: { passwordHash, name: "Enrivea Administrator", role: "admin", status: "active", emailVerifiedAt: now, isDemo: false, mustChangePassword: true, updatedAt: now }, $inc: { authVersion: 1 } });
  } else {
    await users.insertOne({ name: "Enrivea Administrator", email: ADMIN_EMAIL, passwordHash, role: "admin", status: "active", countryCode: "NG", creditBalance: 50, emailVerifiedAt: now, authVersion: 0, isDemo: false, mustChangePassword: true, createdAt: now, updatedAt: now });
  }
  const admin = await users.findOne({ email: ADMIN_EMAIL });

  const samples = [
    { key: "amina", name: "Amina Bello", email: "sample.amina@users.example.invalid", countryCode: "NG", status: "active", balance: 82, plan: "trader" },
    { key: "daniel", name: "Daniel Okafor", email: "sample.daniel@users.example.invalid", countryCode: "GH", status: "active", balance: 24, plan: "starter" },
    { key: "maria", name: "Maria Santos", email: "sample.maria@users.example.invalid", countryCode: "BR", status: "suspended", balance: 7, plan: "starter" },
  ];
  for (const sample of samples) {
    const sampleHash = await hash(randomBytes(32).toString("base64url"), 12);
    await users.updateOne({ email: sample.email }, { $setOnInsert: { name: sample.name, email: sample.email, passwordHash: sampleHash, role: "user", status: sample.status, countryCode: sample.countryCode, creditBalance: sample.balance, emailVerifiedAt: days(-45), authVersion: 0, isDemo: false, mustChangePassword: false, seedKey: `${SEED}:user:${sample.key}`, createdAt: days(-45), updatedAt: days(-2) } }, { upsert: true });
    sample.user = await users.findOne({ email: sample.email });
  }

  const products = [
    { slug: "signals", name: "AI trade ideas scanner", description: "Closed-candle market screening with explainable thesis and defined risk levels.", enabled: true, cost: 1, starter: 25, trader: 100, desk: 300, topupCredits: 25, topupPrice: 15 },
    { slug: "portfolio", name: "Portfolio intelligence", description: "Preview concentration, exposure, and portfolio risk analysis.", enabled: false, cost: 3, starter: 5, trader: 20, desk: 60, topupCredits: 10, topupPrice: 12 },
    { slug: "strategy", name: "Strategy laboratory", description: "Preview scenario testing and strategy comparison.", enabled: false, cost: 5, starter: 0, trader: 10, desk: 30, topupCredits: 10, topupPrice: 20 },
  ];
  for (const product of products) await db.collection("productdefinitions").updateOne({ scope: "live", slug: product.slug }, { $setOnInsert: { ...product, scope: "live", revision: 0, createdAt: now, updatedAt: now } }, { upsert: true });

  const activeUsers = [admin, ...samples.map(item => item.user)];
  for (const user of activeUsers) {
    const sample = samples.find(item => String(item.user._id) === String(user._id));
    const plan = sample?.plan ?? "desk";
    const balance = sample?.balance ?? 50;
    for (const productId of ["signals", "portfolio", "strategy"]) {
      const allocation = productId === "signals" ? balance : productId === "portfolio" ? 5 : 0;
      await db.collection("productaccounts").updateOne({ userId: user._id, productId }, { $setOnInsert: { userId: user._id, productId, creditBalance: allocation, planId: plan, subscriptionStatus: user.status === "active" ? "active" : "expired", currentPeriodStart: days(-12), currentPeriodEnd: days(18), lastPaymentReference: `${SEED}:membership:${user._id}`, createdAt: days(-12), updatedAt: now } }, { upsert: true });
    }
    await db.collection("creditentries").updateOne({ sourceKey: `${SEED}:allocation:${user._id}` }, { $setOnInsert: { userId: user._id, productId: "signals", amount: balance, kind: "purchase", sourceKey: `${SEED}:allocation:${user._id}`, note: "Sample membership allocation", createdAt: days(-12), updatedAt: days(-12) } }, { upsert: true });
  }

  const signalSpecs = [
    [samples[0].user, "BTCUSDT", "4h", "closed", 64250, 62320, 68100, 4.82, "target"],
    [samples[0].user, "ETHUSDT", "1h", "triggered", 3420, 3315, 3630, null, "none"],
    [samples[1].user, "SOLUSDT", "4h", "closed", 142.8, 136.9, 154.6, -4.55, "stop"],
    [samples[1].user, "LINKUSDT", "1d", "watch", 18.42, 17.68, 19.91, null, "none"],
    [admin, "BNBUSDT", "4h", "closed", 584, 565, 621, 5.08, "target"],
    [admin, "XRPUSDT", "1h", "expired", 0.592, 0.568, 0.638, null, "no_entry"],
  ];
  const seededSignals = [];
  for (let index = 0; index < signalSpecs.length; index++) {
    const [user, symbol, interval, status, entry, stop, target, paperReturn, reason] = signalSpecs[index];
    const seedKey = `${SEED}:signal:${index + 1}`;
    await db.collection("signals").updateOne({ seedKey }, { $setOnInsert: { seedKey, userId: user._id, symbol, interval, side: "buy", status, entry, stop, target, thesis: `Sample ${symbol.replace("USDT", "/USDT")} setup generated from closed-candle trend, momentum, volume, and volatility checks.`, riskNote: "Sample research only. Defined invalidation and sizing discipline remain essential.", modelVersion: "sample-seed-v1", marketFacts: { sample: true, trend: "positive", volumeRatio: 1.34, atrPct: 2.1 }, dataCutoff: days(-index - 1), expiresAt: days(7 - index), analysisCost: 1, createdAt: days(-index - 1), updatedAt: days(-index) } }, { upsert: true });
    const signal = await db.collection("signals").findOne({ seedKey });
    seededSignals.push(signal);
    await db.collection("scanruns").updateOne({ userId: user._id, requestId: seedKey }, { $setOnInsert: { userId: user._id, requestId: seedKey, symbol, interval, creditCost: 1, status: "completed", outcome: "setup", summary: "Sample completed market scan", signalId: signal._id, dataCutoff: signal.dataCutoff, charged: true, createdAt: signal.createdAt, updatedAt: signal.updatedAt } }, { upsert: true });
    if (["closed", "expired"].includes(status)) await db.collection("paperoutcomes").updateOne({ signalId: signal._id }, { $setOnInsert: { signalId: signal._id, userId: user._id, status: status === "expired" ? "expired" : "closed", reason, entryAt: reason === "no_entry" ? null : days(-index), exitAt: reason === "no_entry" ? null : days(-index + 1), exitPrice: reason === "target" ? target : reason === "stop" ? stop : null, netReturnPct: paperReturn, methodVersion: "paper-1m-v1", feeRate: 0.001, slippageRate: 0.0005, checkedAt: now, createdAt: signal.createdAt, updatedAt: now } }, { upsert: true });
  }

  for (let index = 0; index < 3; index++) {
    const signal = seededSignals[index];
    await db.collection("orders").updateOne({ clientOrderId: `${SEED}-intent-${index + 1}` }, { $setOnInsert: { userId: signal.userId, signalId: signal._id, exchange: "binance_spot", clientOrderId: `${SEED}-intent-${index + 1}`, exchangeOrderId: null, symbol: signal.symbol, side: "BUY", quantity: index === 0 ? "0.002" : index === 1 ? "0.05" : "1.25", status: index === 2 ? "cancelled" : "intent", filledQuantity: "0", feeAmount: "0", feeAsset: null, errorCode: null, seedKey: `${SEED}:order:${index + 1}`, createdAt: days(-index - 1), updatedAt: days(-index) } }, { upsert: true });
  }

  const notificationSpecs = [
    [admin, "system", "Production workspace initialized", "Core configuration and sample operational records are ready for review.", "/admin/system"],
    [samples[0].user, "research", "BTC paper outcome closed", "The sample BTC/USDT research outcome reached its defined target.", "/dashboard/performance"],
    [samples[1].user, "billing", "Starter membership active", "Your sample monthly membership includes a separate signals credit wallet.", "/dashboard/credits"],
    [samples[2].user, "account", "Account review required", "This sample account is suspended for an administrator workflow demonstration.", "/dashboard/settings"],
  ];
  for (let index = 0; index < notificationSpecs.length; index++) {
    const [user, kind, title, body, href] = notificationSpecs[index];
    await db.collection("notifications").updateOne({ sourceKey: `${SEED}:notification:${index + 1}` }, { $setOnInsert: { userId: user._id, kind, title, body, href, sourceKey: `${SEED}:notification:${index + 1}`, readAt: index === 2 ? now : null, createdAt: days(-index), updatedAt: days(-index) } }, { upsert: true });
  }

  const ticketSpecs = [
    [samples[0].user, "How are paper returns calculated?", "research", "in_progress", "Please explain the fees and slippage used in paper outcomes."],
    [samples[1].user, "Credit wallet question", "billing", "open", "Do unused product credits remain after monthly access expires?"],
  ];
  for (let index = 0; index < ticketSpecs.length; index++) {
    const [user, subject, category, status, body] = ticketSpecs[index];
    await db.collection("supporttickets").updateOne({ seedKey: `${SEED}:ticket:${index + 1}` }, { $setOnInsert: { userId: user._id, isDemo: false, seedKey: `${SEED}:ticket:${index + 1}`, subject, category, priority: index === 0 ? "normal" : "high", status, assignedTo: index === 0 ? admin._id : null, assignedName: index === 0 ? admin.name : "", messages: [{ authorId: user._id, authorName: user.name, staff: false, internal: false, body, createdAt: days(-index - 2) }], revision: 0, createdAt: days(-index - 2), updatedAt: days(-index - 1) } }, { upsert: true });
  }

  for (let index = 0; index < 2; index++) {
    const user = samples[index].user;
    await db.collection("billingpurchases").updateOne({ reference: `${SEED}-billing-${index + 1}` }, { $setOnInsert: { userId: user._id, productId: "signals", kind: index === 0 ? "monthly" : "topup", itemId: index === 0 ? "trader" : "signals", credits: index === 0 ? 100 : 25, reference: `${SEED}-billing-${index + 1}`, expectedAmount: index === 0 ? 250000 : 1500, currency: index === 0 ? "NGN" : "USD", status: "review", providerTransactionId: null, verifiedAt: null, seedKey: `${SEED}:billing:${index + 1}`, createdAt: days(-index - 10), updatedAt: days(-index - 9) } }, { upsert: true });
  }

  await db.collection("exchangeconnectionevents").updateOne({ seedKey: `${SEED}:exchange-event` }, { $setOnInsert: { userId: samples[0].user._id, provider: "binance_spot", action: "checked", detail: "Sample read-only Binance permission check; no credentials stored.", seedKey: `${SEED}:exchange-event`, createdAt: days(-3), updatedAt: days(-3) } }, { upsert: true });
  await db.collection("adminauditevents").updateOne({ actorId: admin._id, targetId: SEED, action: "live_seed_initialized" }, { $setOnInsert: { actorId: admin._id, targetType: "platform", targetId: SEED, action: "live_seed_initialized", before: "empty database", after: "idempotent labeled sample dataset", reason: "Initialize production review data", status: "applied", createdAt: now, updatedAt: now } }, { upsert: true });
  await db.collection("platformconfigs").updateOne({ key: "global" }, { $setOnInsert: { key: "global", registrationOpen: true, scansOpen: true, exchangeConnectionsOpen: true, paperReconciliationOpen: true, contactIntakeOpen: true, allowedScanSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "LTCUSDT", "BCHUSDT", "UNIUSDT", "ATOMUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "TRXUSDT"], announcement: "", createdAt: now, updatedAt: now } }, { upsert: true });

  const collections = ["users", "productdefinitions", "productaccounts", "signals", "orders", "paperoutcomes", "notifications", "supporttickets", "billingpurchases", "adminauditevents"];
  const counts = {};
  for (const name of collections) counts[name] = await db.collection(name).countDocuments();
  console.log(JSON.stringify({ database, admin: { email: ADMIN_EMAIL, role: "admin", mustChangePassword: true }, counts }, null, 2));
} finally {
  await mongoose.disconnect();
}
