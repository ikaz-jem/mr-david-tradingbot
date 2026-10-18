import mongoose from "mongoose";
import { permissionCatalog, systemRoleTemplates } from "../src/lib/access-control-catalog.ts";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
await mongoose.connect(process.env.MONGODB_URI);
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection unavailable");
  const now = new Date();
  const entries = permissionCatalog.filter(entry => entry[0].startsWith("help:"));
  const permissions = db.collection("permissions");
  for (const [key, module, resource, action, description, risk] of entries) {
    await permissions.updateOne({ key }, { $setOnInsert: { key, module, resource, action, name: key, description, risk, active: true, createdAt: now, updatedAt: now } }, { upsert: true });
  }
  const rows = await permissions.find({ key: { $in: entries.map(entry => entry[0]) } }).toArray();
  const byKey = new Map(rows.map(row => [row.key, row._id]));
  const organizations = await db.collection("organizations").find({ kind: "platform" }).project({ _id: 1 }).toArray();
  let added = 0;
  for (const organization of organizations) {
    const roles = await db.collection("accessroles").find({ organizationId: organization._id, slug: { $in: ["admin", "manager", "staff"] }, system: true }).toArray();
    for (const role of roles) {
      const template = systemRoleTemplates.find(item => item.slug === role.slug);
      if (!template) continue;
      for (const key of template.permissions.filter(item => item.startsWith("help:"))) {
        const permissionId = byKey.get(key);
        if (!permissionId) continue;
        const result = await db.collection("rolepermissions").updateOne({ organizationId: organization._id, roleId: role._id, permissionId }, { $setOnInsert: { organizationId: organization._id, roleId: role._id, permissionId, effect: "allow", grantedBy: null, createdAt: now, updatedAt: now } }, { upsert: true });
        added += result.upsertedCount;
      }
    }
  }
  console.log("Help permissions migrated: " + entries.length + " definitions, " + added + " role grants added. Existing denies and custom roles were untouched.");
} finally { await mongoose.disconnect(); }
