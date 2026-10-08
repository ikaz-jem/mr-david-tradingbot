import mongoose from "mongoose";
import { permissionCatalog, systemRoleTemplates } from "../src/lib/access-control-catalog.ts";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");

await mongoose.connect(uri);
const db = mongoose.connection.db;
if (!db) throw new Error("MongoDB connection unavailable");

const now = new Date();
const organizations = db.collection("organizations");
const permissions = db.collection("permissions");
const roles = db.collection("accessroles");
const rolePermissions = db.collection("rolepermissions");
const userRoles = db.collection("userroles");
const users = db.collection("users");

for (const [key, module, resource, action, description, risk] of permissionCatalog) {
  await permissions.updateOne({ key }, { $set: { module, resource, action, name: key, description, risk, active: true, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
}
const permissionRows = await permissions.find({ key: { $in: permissionCatalog.map(item => item[0]) } }).toArray();
const permissionByKey = new Map(permissionRows.map(item => [item.key, item._id]));

async function organizationFor(user) {
  const platformMember = user.role === "admin" || user.role === "staff";
  const slug = platformMember ? `enrivea-${user.isDemo ? "demo" : "operations"}` : `account-${user._id}`;
  const result = await organizations.findOneAndUpdate(
    { slug, isDemo: Boolean(user.isDemo) },
    { $set: { status: "active", updatedAt: now }, $setOnInsert: { name: platformMember ? `Enrivea ${user.isDemo ? "Demo " : ""}Operations` : `${user.name}'s workspace`, slug, kind: platformMember ? "platform" : "customer", isDemo: Boolean(user.isDemo), createdBy: user._id, createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  return result;
}

const allUsers = await users.find({}).toArray();
let migrated = 0;
for (const user of allUsers) {
  const organization = await organizationFor(user);
  await users.updateOne({ _id: user._id }, { $set: { organizationId: organization._id, updatedAt: now } });
  const roleBySlug = new Map();
  for (const template of systemRoleTemplates) {
    const role = await roles.findOneAndUpdate(
      { organizationId: organization._id, slug: template.slug },
      { $set: { name: template.name, description: template.description, system: true, superAdmin: template.superAdmin, status: "active", updatedAt: now }, $setOnInsert: { revision: 0, createdBy: user._id, createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    roleBySlug.set(template.slug, role);
    for (const key of template.permissions) {
      if (key === "*:*") continue;
      const permissionId = permissionByKey.get(key);
      if (permissionId) await rolePermissions.updateOne({ organizationId: organization._id, roleId: role._id, permissionId }, { $set: { effect: "allow", grantedBy: user._id, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    }
  }
  const fallbackSlug = user.role === "admin" ? "super-admin" : user.role === "staff" ? "staff" : "customer";
  const fallbackRole = roleBySlug.get(fallbackSlug);
  if (fallbackRole && !await userRoles.findOne({ organizationId: organization._id, userId: user._id })) {
    await userRoles.insertOne({ organizationId: organization._id, userId: user._id, roleId: fallbackRole._id, assignedBy: user._id, expiresAt: null, createdAt: now, updatedAt: now });
  }
  migrated += 1;
}

console.log(`Access-control migration complete: ${migrated} users, ${permissionRows.length} permissions.`);
await mongoose.disconnect();
