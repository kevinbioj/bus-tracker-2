import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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

	const activeMonths = await database
		.select({ month: sql<string>`DISTINCT TO_CHAR(started_at, 'YYYY-MM')` })
		.from(lineActivitiesTable)
		.where(eq(lineActivitiesTable.lineId, line.id));

	const [latestActivity] = await database
		.select({ serviceDate: lineActivitiesTable.serviceDate })
		.from(lineActivitiesTable)
		.where(eq(lineActivitiesTable.lineId, line.id))
		.orderBy(desc(lineActivitiesTable.serviceDate))
		.limit(1);

	return c.json({
		...line,
		activeMonths: activeMonths.map(({ month }) => month).toSorted((a, b) => a.localeCompare(b)),
		latestServiceDate: latestActivity?.serviceDate ?? null,
	});
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

		let vehicles: {
			id: number;
			number: string;
			designation: string | null;
			activities: { startedAt: Temporal.Instant; endedAt: Temporal.Instant | null }[];
		}[] = [];

		if (lineActivitiesByVehicleId.size > 0) {
			const vehicleData = await database
				.select({ id: vehiclesTable.id, number: vehiclesTable.number, designation: vehiclesTable.designation })
				.from(vehiclesTable)
				.where(inArray(vehiclesTable.id, Array.from(lineActivitiesByVehicleId.keys())));

			vehicles = vehicleData.map((vehicle) => ({
				...vehicle,
				activities: (lineActivitiesByVehicleId.get(vehicle.id) ?? []).map((lineActivity) => ({
					startedAt: lineActivity.startedAt,
					endedAt:
						Temporal.Now.instant().since(lineActivity.endedAt).total("minutes") >= 10 ? lineActivity.endedAt : null,
				})),
			}));
		}

		const activeDays = await database
			.select({ serviceDate: lineActivitiesTable.serviceDate })
			.from(lineActivitiesTable)
			.where(
				and(
					eq(lineActivitiesTable.lineId, id),
					sql`EXTRACT(MONTH FROM service_date) = ${date.month}`,
					sql`EXTRACT(YEAR FROM service_date) = ${date.year}`,
				),
			)
			.groupBy(lineActivitiesTable.serviceDate);

		return c.json(
			{
				activeDays: activeDays.map((d) => d.serviceDate),
				vehicles,
			},
			200,
		);
	},
);
