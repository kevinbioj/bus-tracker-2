import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export function getClientIp(c: Context) {
	return c.req.header("cf-connecting-ip") ?? getConnInfo(c).remote.address ?? "unknown";
}
