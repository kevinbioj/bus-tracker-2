import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { createParamValidator, createQueryValidator } from "../api/validator-helpers.js";
import { database } from "../core/database/database.js";
import { lineActivitiesTable, linesTable, vehiclesTable } from "../core/database/schema.js";
import { journeyStore } from "../core/store/journey-store.js";

import { hono } from "../server.js";
import { keyBy } from "../utils/key-by.js";

const getLineByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

const getLineVehicleAssignmentsQuerySchema = z.object({
	date: z.string().transform((value) => Temporal.PlainDate.from(value)),
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

hono.get(
	"/lines/:id/vehicle-assignments",
	createParamValidator(getLineByIdParamSchema),
	createQueryValidator(getLineVehicleAssignmentsQuerySchema),
	async (c) => {
		const { id } = c.req.valid("param");

		const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
		if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

		const { date } = c.req.valid("query");

		const lineActivities = await database
			.select({
				vehicleId: lineActivitiesTable.vehicleId,
				startedAt: lineActivitiesTable.startedAt,
				endedAt: lineActivitiesTable.updatedAt,
			})
			.from(lineActivitiesTable)
			.where(and(eq(lineActivitiesTable.lineId, id), eq(lineActivitiesTable.serviceDate, date.toString())))
			.orderBy(asc(lineActivitiesTable.startedAt));

		const lineActivitiesByVehicleId = Map.groupBy(lineActivities, (lineActivity) => lineActivity.vehicleId);

		const vehicles = await database
			.select({ id: vehiclesTable.id, number: vehiclesTable.number, designation: vehiclesTable.designation })
			.from(vehiclesTable)
			.where(inArray(vehiclesTable.id, Array.from(lineActivitiesByVehicleId.keys())));

		const response = vehicles.map((vehicle) => ({
			...vehicle,
			activities: (lineActivitiesByVehicleId.get(vehicle.id) ?? []).map((lineActivity) => ({
				startedAt: lineActivity.startedAt,
				endedAt:
					Temporal.Now.instant().since(lineActivity.endedAt).total("minutes") >= 10 ? lineActivity.endedAt : null,
			})),
		}));

		return c.json(response, 200);
	},
);
