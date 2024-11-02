import { and, asc, desc, eq, ilike, lt, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { validator } from "hono/validator";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { database } from "../database/database.js";
import { lineActivities, vehicles } from "../database/schema.js";
import { paginationSchema } from "../helpers/pagination-schema.js";
import { createParamValidator, createQueryValidator } from "../helpers/validator-helpers.js";

const currentMonth = () => Temporal.Now.plainDateISO().toPlainYearMonth();

const searchVehiclesSchema = paginationSchema.extend({
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

export const registerVehicleRoutes = (hono: Hono) => {
	hono.get("/vehicles", createQueryValidator(searchVehiclesSchema), async (c) => {
		const { limit, page, networkId, operatorId, number, designation, sortBy, sortOrder } = c.req.valid("query");

		const vehicleList = await database
			.select()
			.from(vehicles)
			.offset(page * limit)
			.limit(limit)
			.where(
				and(
					networkId ? eq(vehicles.networkId, networkId) : undefined,
					operatorId ? eq(vehicles.operatorId, operatorId) : undefined,
					number ? ilike(vehicles.number, `%${number}%`) : undefined,
					designation ? ilike(vehicles.designation, `%${designation}%`) : undefined,
				),
			)
			.orderBy(sortOrder === "asc" ? asc(vehicles[sortBy]) : desc(vehicles[sortBy]));

		const onlineVehicleList = Map.groupBy(
			await database
				.select({ vehicleId: vehicles.id, lineId: lineActivities.lineId, since: lineActivities.startedAt })
				.from(vehicles)
				.where(lt(sql`EXTRACT(EPOCH from (CURRENT_TIMESTAMP - ${lineActivities.updatedAt}))`, 600))
				.innerJoin(lineActivities, eq(vehicles.id, lineActivities.vehicleId)),
			(currentActivity) => currentActivity.vehicleId,
		);

		const vehicleWithActivityList = vehicleList.map(({ lastSeenAt, ...vehicle }) => {
			// Ce n'est pas possible, dans un monde normal et pour un même véhicule,
			// de tourner sur plusieurs lignes en même temps. Si jamais c'est le cas,
			// et bien on prendra le dernier début puis le reste ira se faire voir 👍
			const currentActivity = onlineVehicleList
				.get(vehicle.id)
				?.toSorted((a, b) => Temporal.Instant.compare(b.since, a.since))
				.at(0);
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

	hono.get(
		"/vehicles/:id",
		validator("param", (values, c) => {
			const parsed = getVehicleByIdParamSchema.safeParse(values);
			if (!parsed.success) return c.json({ error: "Invalid request" }, 400);
			return parsed.data;
		}),
		async (c) => {
			const { id } = c.req.valid("param");

			const [vehicle] = await database.select().from(vehicles).where(eq(vehicles.id, id));
			if (typeof vehicle === "undefined") return c.json({ error: `No vehicle found with id '${id}'.` }, 404);

			const currentActivity = (
				await database
					.select({ vehicleId: vehicles.id, lineId: lineActivities.lineId, since: lineActivities.startedAt })
					.from(vehicles)
					.where(
						and(
							eq(vehicles.id, vehicle.id),
							lt(sql`EXTRACT(EPOCH from (CURRENT_TIMESTAMP - ${lineActivities.updatedAt}))`, 600),
						),
					)
					.innerJoin(lineActivities, eq(vehicles.id, lineActivities.vehicleId))
					.orderBy(desc(lineActivities.startedAt))
			).at(0);

			return c.json({
				...vehicle,
				activity: {
					status: currentActivity ? "online" : "offline",
					since: currentActivity ? currentActivity.since : vehicle.lastSeenAt,
					lineId: currentActivity?.lineId,
				},
			});
		},
	);

	hono.get(
		"/vehicles/:id/activities",
		createParamValidator(getVehicleByIdParamSchema),
		createQueryValidator(getVehicleActivitiesQuerySchema),
		async (c) => {
			const { id } = c.req.valid("param");
			const { month } = c.req.valid("query");

			const [vehicle] = await database.select().from(vehicles).where(eq(vehicles.id, id));
			if (typeof vehicle === "undefined") return c.json({ error: `No vehicle found with id '${id}'.` }, 404);

			const lineActivityList = await database
				.select()
				.from(lineActivities)
				.where(
					and(
						eq(lineActivities.vehicleId, vehicle.id),
						eq(sql`DATE_TRUNC('month', ${lineActivities.serviceDate})`, month.toPlainDate({ day: 1 }).toString()),
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
							startedAt: lineActivity.startedAt,
							updatedAt: lineActivity.updatedAt,
						})) ?? [];

					const activities = [...lineActivitiesThatDay].sort((a, b) =>
						Temporal.Instant.compare(b.startedAt, a.startedAt),
					);
					return { date, activities };
				}),
			});
		},
	);
};
