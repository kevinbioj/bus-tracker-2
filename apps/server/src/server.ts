import { Hono } from "hono";
import { cors } from "hono/cors";

export const hono = new Hono();
hono.use(cors({ origin: "*" }));
