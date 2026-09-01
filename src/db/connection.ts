import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

mongoose.set("strictQuery", true);

let connected = false;

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (connected) return mongoose;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: env.NODE_ENV !== "production",
  });
  connected = true;
  logger.info(
    { db: mongoose.connection.name },
    "MongoDB connected",
  );
  mongoose.connection.on("error", (err) =>
    logger.error({ err }, "MongoDB connection error"),
  );
  mongoose.connection.on("disconnected", () => {
    connected = false;
    logger.warn("MongoDB disconnected");
  });
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

export function dbHealthy(): boolean {
  return mongoose.connection.readyState === 1;
}
