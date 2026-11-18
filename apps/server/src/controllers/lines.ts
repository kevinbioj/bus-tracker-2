import { getVehicleJourneyPositionType, vehicleJourneyPositionTypes } from "@bus-tracker/contracts";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as z from "zod";
import { database } from "../core/database/database.js";
import { lineActivitiesTable, linesTable, vehiclesTable } from "../core/database/schema.js";
import { redis } from "../core/redis.js";
import { findLineVehicleAssignments } from "../core/services/line-assignment-service.js";
import { findRecentLineDestinations } from "../core/services/line-destination-service.js";
import { findLineDetails, findLinePath } from "../core/services/line-details-service.js";
import { findLineAlerts } from "../core/services/service-alert-service.js";
import { journeyStore } from "../core/store/journey-store.js";
import { hono } from "../server.js";
import { keyBy } from "../utils/key-by.js";
import { createParamValidator, createQueryValidator, idSchema } from "../utils/validator-helpers.js";

const getLineByIdParamSchema = z.object({
	id: idSchema,
});

const getLineVehicleAssignmentsQuerySchema = z.object({
	date: z.string().transform((value) => Temporal.PlainDate.from(value)),
});

hono.get("/lines/:id", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const line = await findLineDetails(id);
	if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

	return c.json(line);
});

hono.get("/lines/:id/alerts", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database
		.select({ networkId: linesTable.networkId, references: linesTable.references })
		.from(linesTable)
		.where(eq(linesTable.id, id));
	if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

	return c.json({ items: await findLineAlerts(line), at: Temporal.Now.instant() });
});

hono.get("/lines/:id/online-vehicles", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
	if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

	const onlineJourneys = keyBy(
		journeyStore.values().filter((journey) => journey.lineId === line.id && journey.vehicle?.id !== undefined),
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

const getLineOnlineJourneysQuerySchema = z.object({
	positionTypes: z
		.string()
		.optional()
		.transform((value) => (value !== undefined ? value.split(",") : undefined))
		.pipe(z.array(z.enum(vehicleJourneyPositionTypes)).optional()),
});

hono.get(
	"/lines/:id/online-journeys",
	createParamValidator(getLineByIdParamSchema),
	createQueryValidator(getLineOnlineJourneysQuerySchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const { positionTypes } = c.req.valid("query");

		const [line] = await database.select({ id: linesTable.id }).from(linesTable).where(eq(linesTable.id, id));
		if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

		const journeys = journeyStore
			.values()
			.filter(
				(journey) =>
					journey.lineId === line.id &&
					(positionTypes === undefined || positionTypes.includes(getVehicleJourneyPositionType(journey))),
			)
			.map((journey) => {
				const calls = journey.calls ?? [];
				const monitoredCall = calls.length > 1 ? calls[0] : undefined;
				return {
					id: journey.id,
					number: journey.vehicle?.number,
					direction: journey.direction,
					monitoredStop: monitoredCall?.stopName,
					running: (calls[0]?.distanceTraveled ?? 0) > 0,
					atStop: journey.position.atStop,
					destination: journey.destination,
					departureTime: monitoredCall?.aimedTime,
					arrivalTime: calls.at(-1)?.aimedTime,
				};
			})
			.toArray()
			.sort((a, b) => {
				if (a.number === undefined || b.number === undefined) {
					return (a.number === undefined ? 1 : 0) - (b.number === undefined ? 1 : 0);
				}
				return a.number.localeCompare(b.number, undefined, { numeric: true });
			});

		return c.json(journeys);
	},
);

hono.get("/lines/:id/recent-destinations", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
	if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

	return c.json(await findRecentLineDestinations(line.id));
});

hono.get("/lines/:id/path", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const line = await findLineDetails(id);
	if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

	if ((line.references ?? []).length === 0) return c.json({ error: `No path was found for line '${id}'.` }, 404);
	if (!redis.isReady) return c.json({ error: "Paths are temporarily unavailable." }, 503);

	const path = await findLinePath(line);
	if (path === undefined) return c.json({ error: `No path was found for line '${id}'.` }, 404);

	return c.json(path);
});

hono.get(
	"/lines/:id/vehicle-assignments",
	createParamValidator(getLineByIdParamSchema),
	createQueryValidator(getLineVehicleAssignmentsQuerySchema),
	async (c) => {
		const { id } = c.req.valid("param");

		const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
		if (line === undefined) return c.json({ error: `No line found with id '${id}'.` }, 404);

		const { date } = c.req.valid("query");

		return c.json(await findLineVehicleAssignments(id, date));
	},
);
