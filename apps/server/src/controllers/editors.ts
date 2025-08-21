import type { Hono } from "hono";

import { editorMiddleware } from "../middlewares/editor-middleware.js";

export const registerEditorRoutes = (hono: Hono) => {
	hono.get("/editors/@me", editorMiddleware, async (c) => {
		const { id, username, lastSeenAt, allowedNetworks, createdAt } = c.get("editor");
		return c.json({ id, username, lastSeenAt, allowedNetworks, createdAt });
	});
};
