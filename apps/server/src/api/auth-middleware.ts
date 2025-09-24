import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../core/database/database.js";
import { editorsTable, type EditorRole } from "../core/database/schema.js";
import type { HonoWithSession } from "../server.js";

const hasSufficientRole = (currentRole: EditorRole, targetRole: EditorRole) => {
	if (currentRole === "ADMIN") return true;
	return currentRole === targetRole;
};

type AuthenticatedMiddlewareProps = {
	networkIdParam?: string;
	role?: "ADMIN" | "EDITOR";
};

export const authMiddleware = ({ role = "EDITOR" }: AuthenticatedMiddlewareProps) =>
	createMiddleware<HonoWithSession>(async (c, next) => {
		const session = c.get("session");

		const editorId = session.get("userId");
		if (typeof editorId !== "number") {
			return c.json(
				{ status: 401, code: "UNAUTHENTICATED", message: "You must be authenticated to access this resource." },
				401,
			);
		}

		const [editor] = await database
			.select()
			.from(editorsTable)
			.where(and(eq(editorsTable.id, editorId), eq(editorsTable.enabled, true)));

		if (typeof editor === "undefined") {
			return c.json({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." }, 500);
		}

		editor.lastSeenAt = Temporal.Now.instant();
		database.update(editorsTable).set({ lastSeenAt: editor.lastSeenAt }).where(eq(editorsTable.id, editor.id));

		if (!hasSufficientRole(editor.role, role)) {
			return c.json(
				{ status: 403, code: "UNAUTHORIZED", message: "You are unauthorized to access this resource." },
				403,
			);
		}

		c.set("user", editor);
		await next();
	});
