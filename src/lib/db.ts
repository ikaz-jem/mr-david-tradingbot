import mongoose from "mongoose";
import { getServers, setServers } from "node:dns";

declare global {
  var mongooseConnection: Promise<typeof mongoose> | undefined;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!global.mongooseConnection) {
    global.mongooseConnection = connectWithSrvFallback(uri).catch(error => {
      global.mongooseConnection = undefined;
      throw error;
    });
  }
  return global.mongooseConnection;
}

async function connectWithSrvFallback(uri: string) {
  try {
    return await mongoose.connect(uri, { bufferCommands: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!uri.startsWith("mongodb+srv://") || !/querySrv ECONNREFUSED/i.test(message)) throw error;
    const configured = (process.env.MONGODB_DNS_SERVERS ?? "1.1.1.1,8.8.8.8").split(",").map(value => value.trim()).filter(Boolean);
    if (!configured.length || configured.join(",") === getServers().join(",")) throw error;
    setServers(configured);
    return mongoose.connect(uri, { bufferCommands: false });
  }
}
