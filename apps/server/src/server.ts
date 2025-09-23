import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import v2app from "./api/v2/index.js";

export const hono = new Hono();
hono.use(cors({ origin: "*" }));
hono.use(logger());

hono.route("/v2", v2app);
