import type { Request, Response } from "express";
import * as authService from "../services/authService.js";
import { REFRESH_COOKIE } from "../services/authService.js";

export async function register(req: Request, res: Response) {
  res.status(201).json(await authService.register(req.body, res));
}

export async function login(req: Request, res: Response) {
  res.json(await authService.login(req.body, res));
}

export async function refresh(req: Request, res: Response) {
  const presented = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  res.json(await authService.refresh(presented, res));
}

export async function logout(req: Request, res: Response) {
  const presented = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  await authService.logout(presented, res);
  res.status(204).end();
}
