import type { Request, Response } from "express";
import type { NewsTopic } from "@commune/shared";
import { logger } from "../config/logger.js";
import { getNews } from "../services/newsService.js";
import { AppError } from "../utils/errors.js";

/** Public. The CDN may keep a copy for 10 minutes, so most visitors never reach this code. */
export async function list(_req: Request, res: Response) {
  const { topic } = res.locals.query as { topic: NewsTopic };
  try {
    const items = await getNews(topic);
    res.set("Cache-Control", "public, max-age=60, s-maxage=600, stale-while-revalidate=3600");
    res.json(items);
  } catch (err) {
    logger.error({ err: String(err), topic }, "News unavailable");
    throw new AppError(503, "News is unavailable right now, try again in a few minutes.");
  }
}
