import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../database/database.js";
import { editors, type Editor } from "../database/schema.js";

type EditorMiddlewareVariables = {
	Variables: {
		editor: Editor;
	};
};

export const editorMiddleware = createMiddleware<EditorMiddlewareVariables>(async (c, next) => {
	const editorToken = c.req.header("X-Editor-Token");
	if (typeof editorToken === "undefined") {
		return c.json({ error: "Please authenticate using the 'X-Editor-Token' HTTP header." }, 401);
	}

	const [editor] = await database
		.select()
		.from(editors)
		.where(and(eq(editors.token, editorToken), eq(editors.enabled, true)));

	if (typeof editor === "undefined") {
		return c.json({ error: "No editor was found using the supplied token." }, 401);
	}

	editor.lastSeenAt = Temporal.Now.instant();
	await database.update(editors).set({ lastSeenAt: editor.lastSeenAt }).where(eq(editors.id, editor.id));

	c.set("editor", editor);
	await next();
});
