import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";

import { hono } from "../server.js";
import { createJsonValidator } from "../utils/validator-helpers.js";
import {
	authenticateEditor,
	EDITOR_AUTH_COOKIE_NAME,
	editorCookieOptions,
	editorMiddleware,
} from "./middlewares/editor-middleware.js";

const editorSessionBodySchema = z.object({
	token: z.string().min(1),
});

function editorToJson({
	id,
	username,
	lastSeenAt,
	manageableNetworks,
	createdAt,
}: NonNullable<Awaited<ReturnType<typeof authenticateEditor>>>) {
	return { id, username, lastSeenAt, allowedNetworks: manageableNetworks, createdAt };
}

hono.post("/editors/session", createJsonValidator(editorSessionBodySchema), async (c) => {
	const { token } = c.req.valid("json");
	const editor = await authenticateEditor(token);

	if (editor === undefined) {
		return c.json({ error: "No editor was found using the supplied token." }, 401);
	}

	setCookie(c, EDITOR_AUTH_COOKIE_NAME, token, editorCookieOptions);
	return c.json(editorToJson(editor));
});

hono.delete("/editors/session", async (c) => {
	deleteCookie(c, EDITOR_AUTH_COOKIE_NAME, {
		path: "/",
		secure: true,
	});

	return c.body(null, 204);
});

hono.get("/editors/@me", editorMiddleware({ required: true }), async (c) => {
	return c.json(editorToJson(c.get("editor")));
});
