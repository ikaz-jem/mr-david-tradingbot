import mongoose from "mongoose";

declare global {
  var mongooseConnection: Promise<typeof mongoose> | undefined;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!global.mongooseConnection) {
    global.mongooseConnection = mongoose.connect(uri, { bufferCommands: false }).catch(error => {
      global.mongooseConnection = undefined;
      throw error;
    });
  }
  return global.mongooseConnection;
}
