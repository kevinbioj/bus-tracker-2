import { and, desc, eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import * as z from "zod";

import { database } from "../database/database.js";
import { lineActivities, lines, vehicles } from "../database/schema.js";
import { createParamValidator } from "../helpers/validator-helpers.js";
import type { JourneyStore } from "../store/journey-store.js";

const getLineByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

export const registerLineRoutes = (hono: Hono, store: JourneyStore) => {
	hono.get("/lines/:id", createParamValidator(getLineByIdParamSchema), async (c) => {
		const { id } = c.req.valid("param");

		const [line] = await database.select().from(lines).where(eq(lines.id, id));
		if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

		return c.json(line);
	});

	hono.get("/lines/:id/online-vehicles", createParamValidator(getLineByIdParamSchema), async (c) => {
		const { id } = c.req.valid("param");

		const [line] = await database.select().from(lines).where(eq(lines.id, id));
		if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

		const onlineVehicleIds = store
			.values()
			.flatMap((journey) =>
				journey.lineId === line.id && typeof journey.vehicle?.id !== "undefined" ? [journey.vehicle.id] : [],
			)
			.toArray();

		const vehicleList = await database.select().from(vehicles).where(inArray(vehicles.id, onlineVehicleIds));

		const sinceList = Map.groupBy(
			await database
				.select()
				.from(lineActivities)
				.where(and(inArray(lineActivities.vehicleId, onlineVehicleIds), eq(lineActivities.lineId, line.id)))
				.orderBy(desc(lineActivities.startedAt))
				.limit(vehicleList.length),
			(activity) => activity.vehicleId,
		);

		return c.json(
			vehicleList.map((vehicle) => {
				const journey = store.values().find((journey) => journey.vehicle?.id === vehicle.id);
				const sinceData = sinceList.get(vehicle.id)?.[0]!;
				return {
					...vehicle,
					activity: {
						status: "online",
						since: sinceData.startedAt,
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
};
