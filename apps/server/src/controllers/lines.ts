import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import * as z from "zod";

import { database } from "../database/database.js";
import { lines } from "../database/schema.js";
import { createParamValidator } from "../helpers/validator-helpers.js";

const getLineByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

export const registerLineRoutes = (hono: Hono) => {
	hono.get("/lines/:id", createParamValidator(getLineByIdParamSchema), async (c) => {
		const { id } = c.req.valid("param");

		const [line] = await database.select().from(lines).where(eq(lines.id, id));
		if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

		return c.json(line);
	});
};
