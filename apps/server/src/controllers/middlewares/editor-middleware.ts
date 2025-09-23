import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { editorsTable, type EditorEntity } from "../../core/database/schema.js";

type EditorMiddlewareProps<Required extends boolean> = {
	required?: Required;
};

type EditorMiddlewareVariables<Required extends boolean> = {
	Variables: {
		editor: Required extends true ? EditorEntity : EditorEntity | undefined;
	};
};

export const editorMiddleware = <Required extends boolean = false>({ required }: EditorMiddlewareProps<Required>) =>
	createMiddleware<EditorMiddlewareVariables<Required>>(async (c, next) => {
		const editorToken = c.req.header("X-Editor-Token");
		if (typeof editorToken === "undefined") {
			if (required) return c.json({ error: "Please authenticate using the 'X-Editor-Token' HTTP header." }, 401);
			await next();
			return;
		}

		const [editor] = await database
			.select()
			.from(editorsTable)
			.where(and(eq(editorsTable.token, editorToken), eq(editorsTable.enabled, true)));

		if (typeof editor === "undefined") {
			return c.json({ error: "No editor was found using the supplied token." }, 401);
		}

		editor.lastSeenAt = Temporal.Now.instant();
		await database.update(editorsTable).set({ lastSeenAt: editor.lastSeenAt }).where(eq(editorsTable.id, editor.id));

		c.set("editor", editor);
		await next();
	});
