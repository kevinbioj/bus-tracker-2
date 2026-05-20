import { and, eq } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { database } from "../../core/database/database.js";
import { type EditorEntity, editorsTable } from "../../core/database/schema.js";

export const EDITOR_AUTH_COOKIE_NAME = "auth";
export const editorCookieOptions = {
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 365,
	path: "/",
	sameSite: "Strict",
	secure: true,
} as const;

type EditorMiddlewareProps<Required extends boolean> = {
	required?: Required;
};

type EditorMiddlewareVariables<Required extends boolean> = {
	Variables: {
		editor: Required extends true ? EditorEntity : EditorEntity | undefined;
	};
};

export async function authenticateEditor(editorToken: string) {
	const [editor] = await database
		.select()
		.from(editorsTable)
		.where(and(eq(editorsTable.token, editorToken), eq(editorsTable.enabled, true)));

	if (editor === undefined) return undefined;

	editor.lastSeenAt = Temporal.Now.instant();
	await database.update(editorsTable).set({ lastSeenAt: editor.lastSeenAt }).where(eq(editorsTable.id, editor.id));

	return editor;
}

export const editorMiddleware = <Required extends boolean = false>({ required }: EditorMiddlewareProps<Required>) =>
	createMiddleware<EditorMiddlewareVariables<Required>>(async (c, next) => {
		const editorToken = getCookie(c, EDITOR_AUTH_COOKIE_NAME) ?? c.req.header("X-Editor-Token");
		if (editorToken === undefined) {
			if (required) return c.json({ error: "Please authenticate." }, 401);
			await next();
			return;
		}

		const editor = await authenticateEditor(editorToken);
		if (editor === undefined) {
			return c.json({ error: "No editor was found using the supplied token." }, 401);
		}

		c.set("editor", editor);
		setCookie(c, EDITOR_AUTH_COOKIE_NAME, editorToken, editorCookieOptions);
		await next();
	});
