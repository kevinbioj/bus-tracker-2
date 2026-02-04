import { vehicleJourneyLineTypeEnum } from "@bus-tracker/contracts";
import { and, asc, between, desc, eq, ilike, isNotNull, isNull, gt, sql, inArray } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import { match } from "ts-pattern";
import * as z from "zod";

import { createJsonValidator, createParamValidator, createQueryValidator } from "../api/validator-helpers.js";
import { database } from "../core/database/database.js";
import {
	editionLogsTable,
	lineActivitiesTable,
	networksTable,
	operatorsTable,
	vehicleArchiveReasons,
	vehiclesTable,
} from "../core/database/schema.js";
import { journeyStore } from "../core/store/journey-store.js";
import { editorMiddleware } from "./middlewares/editor-middleware.js";

import { hono } from "../server.js";
import { keyBy } from "../utils/key-by.js";

const currentMonth = () => Temporal.Now.plainDateISO().toPlainYearMonth();

const searchVehiclesSchema = z.object({
	limit: z.coerce
		.number()
		.int("Limit must be an integer")
		.min(10, "Limit must be within [10; 100000]")
		.max(100000, "Limit must be within [10; 100000]")
		.default(10000),
	page: z.coerce.number().int("Page must be an integer").min(0, "Page must be a positive integer").default(0),
	networkId: z.coerce
		.number()
		.int("Network id must be an integer")
		.min(0, "Network id must be a positive integer")
		.optional(),
	operatorId: z.coerce
		.number()
		.int("Operator id must be an integer")
		.min(0, "Operator id must be a positive integer")
		.optional(),
	number: z.string().optional(),
	designation: z.string().optional(),
	sortBy: z.enum(["number", "designation"]).default("number"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	archived: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
});

const getVehicleByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

const getVehicleActivitiesQuerySchema = z.object({
	month: z
		.string()
		.regex(/20\d\d-\d\d/, "Invalid month format (expected e.g. 2024-10)")
		.default(() => currentMonth().toString())
		.transform((value) => Temporal.PlainYearMonth.from(value))
		.refine(
			(yearMonth) => Temporal.PlainYearMonth.compare(yearMonth, currentMonth()) <= 0,
			"The selected month must be the same or before as the current month.",
		),
});

const updateVehicleBodySchema = z.object({
	number: z.string().min(1, "Expected 'number' to be non-empty."),
	designation: z.string().nullable(),
	tcId: z.number().min(1, "Expected 'tcId' to be a valid identifier.").nullable(),
	type: vehicleJourneyLineTypeEnum,
});

const archiveVehicleBodySchema = z.object({
	reason: z.enum(vehicleArchiveReasons),
	wipeReference: z.boolean(),
});

hono.get("/vehicles", createQueryValidator(searchVehiclesSchema), async (c) => {
	const { limit, page, networkId, operatorId, number, designation, sortBy, sortOrder, archived } = c.req.valid("query");

	const vehiclesListWhereClause = and(
		networkId ? eq(vehiclesTable.networkId, networkId) : undefined,
		operatorId ? eq(vehiclesTable.operatorId, operatorId) : undefined,
		number ? ilike(vehiclesTable.number, `%${number}%`) : undefined,
		designation ? ilike(vehiclesTable.designation, `%${designation}%`) : undefined,
		match(archived)
			.with(true, () => isNotNull(vehiclesTable.archivedAt))
			.with(false, () => isNull(vehiclesTable.archivedAt))
			.otherwise(() => undefined),
	);

	const vehicleList = await database
		.select()
		.from(vehiclesTable)
		.where(vehiclesListWhereClause)
		.orderBy(sortOrder === "asc" ? asc(vehiclesTable[sortBy]) : desc(vehiclesTable[sortBy]))
		.offset(page * limit)
		.limit(limit);

	const recentActivities = await database
		.select({
			vehicleId: lineActivitiesTable.vehicleId,
			lineId: lineActivitiesTable.lineId,
			since: lineActivitiesTable.startedAt,
		})
		.from(lineActivitiesTable)
		.where(
			and(
				inArray(
					lineActivitiesTable.vehicleId,
					vehicleList.map((v) => v.id),
				),
				gt(lineActivitiesTable.updatedAt, sql`NOW() - INTERVAL '10 minutes'`),
			),
		)
		.orderBy(desc(lineActivitiesTable.updatedAt));

	const lastActivityByVehicleId = keyBy(recentActivities, (currentActivity) => currentActivity.vehicleId, "ignore");

	const vehicleWithActivityList = vehicleList.map(({ lastSeenAt, ...vehicle }) => {
		// Ce n'est pas possible, dans un monde normal et pour un même véhicule,
		// de tourner sur plusieurs lignes en même temps. Si jamais c'est le cas,
		// et bien on prendra le dernier début puis le reste ira se faire voir 👍
		const currentActivity = lastActivityByVehicleId.get(vehicle.id);

		return {
			...vehicle,
			activity: {
				status: currentActivity ? "online" : "offline",
				since: currentActivity ? currentActivity.since : lastSeenAt,
				lineId: currentActivity?.lineId,
			},
		};
	});

	return c.json(vehicleWithActivityList);
});

hono.get("/vehicles/:id", createParamValidator(getVehicleByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [data] = await database
		.select()
		.from(vehiclesTable)
		.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
		.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
		.where(eq(vehiclesTable.id, id));
	if (typeof data === "undefined") return c.json({ error: `No vehicle found with id '${id}'.` }, 404);

	const { vehicle, network, operator } = data;

	const currentActivity = (
		await database
			.select({
				vehicleId: lineActivitiesTable.vehicleId,
				lineId: lineActivitiesTable.lineId,
				since: lineActivitiesTable.startedAt,
			})
			.from(lineActivitiesTable)
			.where(
				and(
					eq(lineActivitiesTable.vehicleId, vehicle.id),
					gt(lineActivitiesTable.updatedAt, sql`NOW() - INTERVAL '10 minutes'`),
				),
			)
			.orderBy(desc(lineActivitiesTable.startedAt))
			.limit(1)
	).at(0);

	const activeMonths = await database
		.select({ month: sql<string>`DISTINCT TO_CHAR(started_at, 'YYYY-MM')` })
		.from(lineActivitiesTable)
		.where(eq(lineActivitiesTable.vehicleId, vehicle.id));

	const journey = journeyStore.values().find((journey) => journey.vehicle?.id === vehicle.id);

	return c.json({
		...vehicle,
		operator,
		activity: {
			status: currentActivity ? "online" : "offline",
			since:
				(currentActivity ? currentActivity.since : vehicle.lastSeenAt)?.toZonedDateTimeISO(network.timezone) ?? null,
			lineId: currentActivity?.lineId,
			markerId: journey?.id,
			position: journey
				? {
						latitude: journey.position.latitude,
						longitude: journey.position.longitude,
					}
				: undefined,
		},
		activeMonths: activeMonths.map(({ month }) => month).toSorted((a, b) => a.localeCompare(b)),
	});
});

hono.get(
	"/vehicles/:id/activities",
	createParamValidator(getVehicleByIdParamSchema),
	createQueryValidator(getVehicleActivitiesQuerySchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const { month } = c.req.valid("query");

		const [data] = await database
			.select()
			.from(vehiclesTable)
			.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
			.where(eq(vehiclesTable.id, id));
		if (typeof data === "undefined") return c.json({ error: `No vehicle found with id '${id}'.` }, 404);

		const { vehicle, network } = data;

		const lineActivityList = await database
			.select()
			.from(lineActivitiesTable)
			.where(
				and(
					eq(lineActivitiesTable.vehicleId, vehicle.id),
					between(
						lineActivitiesTable.serviceDate,
						month.toPlainDate({ day: 1 }).toString(),
						month.toPlainDate({ day: month.daysInMonth }).toString(),
					),
				),
			);

		const lineActivitiesByDay = Map.groupBy(lineActivityList, (lineActivity) => lineActivity.serviceDate);

		const dates = [...new Set(lineActivitiesByDay.keys())]
			.map((date) => Temporal.PlainDate.from(date))
			.toSorted((a, b) => Temporal.PlainYearMonth.compare(b, a));

		return c.json({
			timeline: dates.map((date) => {
				const lineActivitiesThatDay =
					lineActivitiesByDay.get(date.toString())?.map((lineActivity) => ({
						type: "LINE_ACTIVITY" as const,
						lineId: lineActivity.lineId,
						startedAt: Temporal.Instant.from(lineActivity.startedAt)
							.toZonedDateTimeISO(network.timezone)
							.toString({ timeZoneName: "never" }),
						updatedAt: Temporal.Instant.from(lineActivity.updatedAt)
							.toZonedDateTimeISO(network.timezone)
							.toString({ timeZoneName: "never" }),
					})) ?? [];

				const activities = [...lineActivitiesThatDay].sort((a, b) =>
					Temporal.Instant.compare(b.startedAt, a.startedAt),
				);
				return { date, activities };
			}),
		});
	},
);

hono.put(
	"/vehicles/:id",
	editorMiddleware({ required: true }),
	createParamValidator(getVehicleByIdParamSchema),
	createJsonValidator(updateVehicleBodySchema),
	async (c) => {
		const { id } = c.req.valid("param");

		const [vehicle] = await database
			.select()
			.from(vehiclesTable)
			.where(and(eq(vehiclesTable.id, id)));
		if (typeof vehicle === "undefined") return c.json({ error: `No vehicle found with id '${id}'.` }, 404);

		const editor = c.get("editor");

		if (!Array.isArray(editor.manageableNetworks) || !editor.manageableNetworks.includes(vehicle.networkId)) {
			return c.json({ error: "Your privileges do not allow you to edit this vehicle" }, 403);
		}

		const data = c.req.valid("json");
		const updatedFields: { field: string; oldValue: string | number | null; newValue: string | number | null }[] = [];

		if (vehicle.number !== data.number) {
			updatedFields.push({ field: "number", oldValue: vehicle.number, newValue: data.number });
		}

		if (vehicle.designation !== data.designation) {
			updatedFields.push({ field: "designation", oldValue: vehicle.designation, newValue: data.designation });
		}

		if (vehicle.tcId !== data.tcId) {
			updatedFields.push({ field: "tcId", oldValue: vehicle.tcId, newValue: data.tcId });
		}

		if (vehicle.type !== data.type) {
			updatedFields.push({ field: "type", oldValue: vehicle.type, newValue: data.type });
		}

		await database.update(vehiclesTable).set(data).where(eq(vehiclesTable.id, vehicle.id));

		await database.insert(editionLogsTable).values({
			editorId: editor.id,
			networkId: vehicle.networkId,
			vehicleId: vehicle.id,
			updatedFields,
		});

		return c.body(null, 204);
	},
);

hono.post(
	"/vehicles/:id/archive",
	editorMiddleware({ required: true }),
	createParamValidator(getVehicleByIdParamSchema),
	createJsonValidator(archiveVehicleBodySchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const { reason, wipeReference } = c.req.valid("json");

		const [vehicle] = await database
			.select()
			.from(vehiclesTable)
			.where(and(eq(vehiclesTable.id, id)));
		if (typeof vehicle === "undefined") return c.json({ error: `No vehicle found with id '${id}'.` }, 404);

		const editor = c.get("editor");

		if (!Array.isArray(editor.manageableNetworks) || !editor.manageableNetworks.includes(vehicle.networkId)) {
			return c.json({ error: "Your privileges do not allow you to edit this vehicle" }, 403);
		}

		if (vehicle.archivedAt !== null) {
			return c.json({ error: "This vehicle has already been archived" }, 400);
		}

		const fields = {
			archivedAt: Temporal.Now.instant(),
			archivedFor: reason,
			ref: wipeReference ? `${vehicle.ref}:ARCHIVED` : vehicle.ref,
		};

		await database.update(vehiclesTable).set(fields).where(eq(vehiclesTable.id, vehicle.id));

		await database.insert(editionLogsTable).values({
			editorId: editor.id,
			networkId: vehicle.networkId,
			vehicleId: vehicle.id,
			updatedFields: [
				{ type: "archivedAt", oldValue: null, newValue: fields.archivedAt },
				{ type: "archivedFor", oldValue: null, newValue: reason },
				...(wipeReference ? [{ type: "ref", oldValue: vehicle.ref, newValue: fields.ref }] : []),
			],
		});

		return c.body(null, 204);
	},
);
