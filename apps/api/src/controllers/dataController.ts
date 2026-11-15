import type { Request, Response } from "express";
import type { DeleteAccountInput } from "@commune/shared";
import { clearRefreshCookie } from "../services/authService.js";
import { buildDataExport, deleteAccount } from "../services/accountDataService.js";

/** Everything the site holds about the signed-in person, as a JSON file they can keep. */
export async function exportMyData(req: Request, res: Response) {
  const data = await buildDataExport(req.userId!);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", 'attachment; filename="commune-data.json"');
  res.json(data);
}

/** Erases the signed-in person's account and signs this browser out. */
export async function deleteMyAccount(req: Request, res: Response) {
  await deleteAccount(req.userId!, req.body as DeleteAccountInput);
  clearRefreshCookie(res);
  res.status(204).end();
}
