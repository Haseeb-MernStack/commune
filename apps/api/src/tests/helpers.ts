import type { Express } from "express";
import request from "supertest";
import { vi } from "vitest";
import { User } from "../models/User.js";

/**
 * Makes the user lookup in requireActive return a fixed user (or null), so tests can cover
 * roles and suspensions without a database. Undo with vi.restoreAllMocks().
 */
export function mockUser(user: { role: "user" | "admin"; banned: boolean } | null) {
  return vi.spyOn(User, "findById").mockImplementation((() => ({
    select: () => ({ lean: () => Promise.resolve(user) }),
  })) as never);
}

/** Sends a request, optionally with a Bearer token. */
export function call(
  app: Express,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  token?: string,
) {
  const req = request(app)[method](path);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}
