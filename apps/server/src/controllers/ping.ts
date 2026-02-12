import { hono } from "../server.js";

hono.get("/ping", (c) => c.body("Pong!", 200));
