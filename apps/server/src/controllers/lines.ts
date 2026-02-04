import { and, desc, eq, inArray } from "drizzle-orm";
import * as z from "zod";

import { createParamValidator } from "../api/validator-helpers.js";
import { database } from "../core/database/database.js";
import { lineActivitiesTable, linesTable, vehiclesTable } from "../core/database/schema.js";
import { journeyStore } from "../core/store/journey-store.js";

import { hono } from "../server.js";
import { keyBy } from "../utils/key-by.js";

const getLineByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

hono.get("/lines/:id", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
	if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

	return c.json(line);
});

hono.get("/lines/:id/online-vehicles", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
	if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

	const onlineJourneys = keyBy(
		journeyStore.values().filter((journey) => journey.lineId === line.id && typeof journey.vehicle?.id !== "undefined"),
		(journey) => journey.vehicle?.id ?? -1,
	);

	const onlineVehicleIds = Array.from(onlineJourneys.keys());

	const vehicleList = await database.select().from(vehiclesTable).where(inArray(vehiclesTable.id, onlineVehicleIds));

	const sinceList = keyBy(
		await database
			.select()
			.from(lineActivitiesTable)
			.where(and(inArray(lineActivitiesTable.vehicleId, onlineVehicleIds), eq(lineActivitiesTable.lineId, line.id)))
			.orderBy(desc(lineActivitiesTable.startedAt))
			.limit(vehicleList.length * 2),
		(activity) => activity.vehicleId,
		"ignore",
	);

	return c.json(
		vehicleList.map((vehicle) => {
			const journey = onlineJourneys.get(vehicle.id);
			const sinceData = sinceList.get(vehicle.id);
			return {
				...vehicle,
				activity: {
					status: "online",
					since: sinceData?.startedAt,
					lineId: line.id,
					markerId: journey?.id,
					position: journey
						? {
								latitude: journey.position.latitude,
								longitude: journey.position.longitude,
							}
						: undefined,
				},
			};
		}),
	);
});
