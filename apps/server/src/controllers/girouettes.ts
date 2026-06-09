import { eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "../core/database/database.js";
import { editionLogsTable, girouettesTable, linesTable } from "../core/database/schema.js";
import { hono } from "../server.js";
import { createJsonValidator, createParamValidator } from "../utils/validator-helpers.js";
import { editorMiddleware } from "./middlewares/editor-middleware.js";

const lineIdParamSchema = z.object({
	lineId: z.coerce.number().int().min(0),
});

const girouetteIdParamSchema = z.object({
	id: z.coerce.number().int().min(0),
});

const girouetteInputSchema = z.object({
	directionId: z.number().int().min(0).max(1).nullable(),
	destinations: z.array(z.string()),
	data: z.record(z.string(), z.unknown()),
	enabled: z.boolean().default(true),
});

const toggleEnabledSchema = z.object({
	enabled: z.boolean(),
});

async function getLineAndCheckPermission(lineId: number, editorNetworks: unknown) {
	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, lineId));
	if (line === undefined) return { line: null, forbidden: false };
	const networks = Array.isArray(editorNetworks) ? editorNetworks : [];
	if (!networks.includes(line.networkId)) return { line, forbidden: true };
	return { line, forbidden: false };
}

hono.get(
	"/lines/:lineId/girouettes",
	editorMiddleware({ required: true }),
	createParamValidator(lineIdParamSchema),
	async (c) => {
		const { lineId } = c.req.valid("param");
		const editor = c.get("editor");

		const { line, forbidden } = await getLineAndCheckPermission(lineId, editor.manageableNetworks);
		if (line === null) return c.json({ error: `No line found with id '${lineId}'.` }, 404);
		if (forbidden) return c.json({ error: "Your privileges do not allow you to manage this line." }, 403);

		const girouettes = await database.select().from(girouettesTable).where(eq(girouettesTable.lineId, lineId));

		return c.json(girouettes);
	},
);

hono.post(
	"/lines/:lineId/girouettes",
	editorMiddleware({ required: true }),
	createParamValidator(lineIdParamSchema),
	createJsonValidator(girouetteInputSchema),
	async (c) => {
		const { lineId } = c.req.valid("param");
		const editor = c.get("editor");

		const { line, forbidden } = await getLineAndCheckPermission(lineId, editor.manageableNetworks);
		if (line === null) return c.json({ error: `No line found with id '${lineId}'.` }, 404);
		if (forbidden) return c.json({ error: "Your privileges do not allow you to manage this line." }, 403);

		const { directionId, destinations, data, enabled } = c.req.valid("json");

		const [created] = await database
			.insert(girouettesTable)
			.values({ networkId: line.networkId, lineId, directionId, destinations, data, enabled })
			.returning();

		await database.insert(editionLogsTable).values({
			editorId: editor.id,
			networkId: line.networkId,
			lineId,
			updatedFields: [{ action: "create_girouette", girouetteId: created!.id }],
		});

		return c.json(created, 201);
	},
);

hono.put(
	"/girouettes/:id",
	editorMiddleware({ required: true }),
	createParamValidator(girouetteIdParamSchema),
	createJsonValidator(girouetteInputSchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const editor = c.get("editor");

		const [girouette] = await database.select().from(girouettesTable).where(eq(girouettesTable.id, id));
		if (girouette === undefined) return c.json({ error: `No girouette found with id '${id}'.` }, 404);

		const networks = Array.isArray(editor.manageableNetworks) ? editor.manageableNetworks : [];
		if (!networks.includes(girouette.networkId)) {
			return c.json({ error: "Your privileges do not allow you to manage this girouette." }, 403);
		}

		const { directionId, destinations, data, enabled } = c.req.valid("json");

		const [updated] = await database
			.update(girouettesTable)
			.set({ directionId, destinations, data, enabled })
			.where(eq(girouettesTable.id, id))
			.returning();

		await database.insert(editionLogsTable).values({
			editorId: editor.id,
			networkId: girouette.networkId,
			lineId: girouette.lineId,
			updatedFields: [{ action: "update_girouette", girouetteId: id }],
		});

		return c.json(updated);
	},
);

hono.patch(
	"/girouettes/:id/enabled",
	editorMiddleware({ required: true }),
	createParamValidator(girouetteIdParamSchema),
	createJsonValidator(toggleEnabledSchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const editor = c.get("editor");

		const [girouette] = await database.select().from(girouettesTable).where(eq(girouettesTable.id, id));
		if (girouette === undefined) return c.json({ error: `No girouette found with id '${id}'.` }, 404);

		const networks = Array.isArray(editor.manageableNetworks) ? editor.manageableNetworks : [];
		if (!networks.includes(girouette.networkId)) {
			return c.json({ error: "Your privileges do not allow you to manage this girouette." }, 403);
		}

		const { enabled } = c.req.valid("json");

		const [updated] = await database
			.update(girouettesTable)
			.set({ enabled })
			.where(eq(girouettesTable.id, id))
			.returning();

		await database.insert(editionLogsTable).values({
			editorId: editor.id,
			networkId: girouette.networkId,
			lineId: girouette.lineId,
			updatedFields: [{ action: "toggle_girouette_enabled", girouetteId: id, enabled }],
		});

		return c.json(updated);
	},
);

hono.delete(
	"/girouettes/:id",
	editorMiddleware({ required: true }),
	createParamValidator(girouetteIdParamSchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const editor = c.get("editor");

		const [girouette] = await database.select().from(girouettesTable).where(eq(girouettesTable.id, id));
		if (girouette === undefined) return c.json({ error: `No girouette found with id '${id}'.` }, 404);

		const networks = Array.isArray(editor.manageableNetworks) ? editor.manageableNetworks : [];
		if (!networks.includes(girouette.networkId)) {
			return c.json({ error: "Your privileges do not allow you to manage this girouette." }, 403);
		}

		await database.delete(girouettesTable).where(eq(girouettesTable.id, id));

		await database.insert(editionLogsTable).values({
			editorId: editor.id,
			networkId: girouette.networkId,
			lineId: girouette.lineId,
			updatedFields: [{ action: "delete_girouette", girouetteId: id }],
		});

		return c.body(null, 204);
	},
);
