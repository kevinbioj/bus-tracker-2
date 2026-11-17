import { and, eq } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { database } from "../../core/database/database.js";
import { type EditorEntity, editorsTable } from "../../core/database/schema.js";
import { getClientIp } from "../../utils/client-ip.js";

export const EDITOR_AUTH_COOKIE_NAME = "auth";
export const editorCookieOptions = {
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 365,
	path: "/",
	sameSite: "Strict",
	secure: true,
} as const;

const MAX_FAILED_AUTHENTICATIONS = 10;
const FAILED_AUTHENTICATIONS_WINDOW_MS = 15 * 60_000;

const failedAuthentications = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of failedAuthentications) {
		if (entry.resetAt <= now) failedAuthentications.delete(ip);
	}
}, FAILED_AUTHENTICATIONS_WINDOW_MS).unref();

export function isAuthenticationBlocked(ip: string) {
	const entry = failedAuthentications.get(ip);
	return entry !== undefined && entry.resetAt > Date.now() && entry.count >= MAX_FAILED_AUTHENTICATIONS;
}

export function recordFailedAuthentication(ip: string) {
	const now = Date.now();
	const entry = failedAuthentications.get(ip);
	if (entry === undefined || entry.resetAt <= now) {
		failedAuthentications.set(ip, { count: 1, resetAt: now + FAILED_AUTHENTICATIONS_WINDOW_MS });
	} else {
		entry.count += 1;
	}
}

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

		const ip = getClientIp(c);
		if (isAuthenticationBlocked(ip)) return c.json({ error: "Too many failed authentication attempts." }, 429);

		const editor = await authenticateEditor(editorToken);
		if (editor === undefined) {
			recordFailedAuthentication(ip);
			return c.json({ error: "No editor was found using the supplied token." }, 401);
		}

		c.set("editor", editor);
		setCookie(c, EDITOR_AUTH_COOKIE_NAME, editorToken, editorCookieOptions);
		await next();
	});
