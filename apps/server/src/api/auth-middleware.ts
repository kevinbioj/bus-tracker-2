import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../core/database/database.js";
import { editorsTable, type EditorRole } from "../core/database/schema.js";

const hasSufficientRole = (currentRole: EditorRole, targetRole: EditorRole) => {
	if (currentRole === "ADMIN") return true;
	return currentRole === targetRole;
};

type AuthenticatedMiddlewareProps = {
	networkIdParam?: string;
	role?: "ADMIN" | "EDITOR";
};

export const authMiddleware = ({ role = "EDITOR" }: AuthenticatedMiddlewareProps) =>
	createMiddleware(async (c, next) => {
		const editorToken = c.req.header("X-Editor-Token");

		if (typeof editorToken === "undefined") {
			return c.json({ code: 401, message: "Please authenticate using the 'X-Editor-Token' HTTP header." }, 401);
		}

		const [editor] = await database
			.select()
			.from(editorsTable)
			.where(and(eq(editorsTable.token, editorToken), eq(editorsTable.enabled, true)));

		if (typeof editor === "undefined") {
			return c.json({ code: 401, message: "No editor was found using the supplied token." }, 401);
		}

		editor.lastSeenAt = Temporal.Now.instant();
		database.update(editorsTable).set({ lastSeenAt: editor.lastSeenAt }).where(eq(editorsTable.id, editor.id));

		if (!hasSufficientRole(editor.role, role)) {
			return c.json({ code: 403, message: "You are unauthorized to access this resource." }, 403);
		}

		c.set("user", editor);
		await next();
	});
