import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const hono = new Hono();
hono.use(cors({ origin: "*" }));
hono.use(logger());
