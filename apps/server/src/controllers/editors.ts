import { editorMiddleware } from "./middlewares/editor-middleware.js";

import { hono } from "../server.js";

hono.get("/editors/@me", editorMiddleware({ required: true }), async (c) => {
	const { id, username, lastSeenAt, manageableNetworks, createdAt } = c.get("editor");
	return c.json({ id, username, lastSeenAt, allowedNetworks: manageableNetworks, createdAt });
});
