import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  // Every serverless instance opens its own pool. The driver default (100) lets a traffic burst
  // exhaust a free Atlas cluster (500 connections), so keep the pool small. Raise it with
  // MONGODB_MAX_POOL on a long-running server that needs more parallel queries.
  const maxPoolSize = Number(process.env.MONGODB_MAX_POOL) || 10;
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize });
  logger.info("MongoDB connected");
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
