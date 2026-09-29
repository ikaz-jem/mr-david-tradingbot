import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { hash } from "bcryptjs";
import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is missing.");
  process.exit(1);
}

const terminal = createInterface({ input, output, terminal: true });
const email = (await terminal.question("Administrator email: ")).trim().toLowerCase();
terminal.close();

async function hiddenQuestion(prompt) {
  output.write(prompt);
  input.setRawMode?.(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      input.setRawMode?.(false);
      input.pause();
      input.off("data", onData);
      output.write("\n");
      resolve(value);
    };
    const onData = chunk => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          input.setRawMode?.(false);
          reject(new Error("Cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\b" || character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    input.on("data", onData);
  });
}

const password = await hiddenQuestion("Temporary password: ");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
if (password.length < 8 || password.length > 128) throw new Error("Temporary password must be 8 to 128 characters.");

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
try {
  const users = mongoose.connection.collection("users");
  const existing = await users.findOne({ email });
  if (existing?.isDemo) throw new Error("A demo identity cannot be converted into a production administrator.");
  const passwordHash = await hash(password, 12);
  const now = new Date();
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: { passwordHash, role: "admin", status: "active", emailVerifiedAt: now, mustChangePassword: true, isDemo: false, updatedAt: now },
        $inc: { authVersion: 1 },
      },
    );
    console.log("Administrator updated. Existing sessions were revoked; password rotation is required at next sign-in.");
  } else {
    await users.insertOne({
      name: "Enrivea Administrator",
      email,
      passwordHash,
      role: "admin",
      status: "active",
      countryCode: null,
      creditBalance: 0,
      emailVerifiedAt: now,
      authVersion: 0,
      isDemo: false,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log("Administrator created. Password rotation is required at first sign-in.");
  }
} finally {
  await mongoose.disconnect();
}
