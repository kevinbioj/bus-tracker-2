import type { Hono } from "hono";
import { Temporal } from "temporal-polyfill";
// import * as z from "zod";

import { inArray } from "drizzle-orm";
import { database } from "../database/database.js";
import { type Line, type Network, type Operator, lines, networks, operators } from "../database/schema.js";
import type { JourneyStore } from "../store/journey-store.js";

// const getVehicleJourneysQuerySchema = z.object({
// 	latitude: z.coerce
// 		.number()
// 		.min(-90, "Latitude must be within range [-90; 90]")
// 		.max(90, "Latitude must be within range [-90; 90]"),
// 	longitude: z.coerce
// 		.number()
// 		.min(-180, "Latitude must be within range [-180; 180]")
// 		.max(180, "Latitude must be within range [-180; 180]"),
// 	zoom: z.coerce.number(),
// });

type DisposeableVehicleJourney = {
	id: string;
	line?: Line;
	direction?: "OUTBOUND" | "INBOUND";
	destination?: string;
	calls?: Array<{
		aimedTime: string;
		expectedTime?: string;
		stopRef: string;
		stopName: string;
		stopOrder: number;
		callStatus: "SCHEDULED" | "SKIPPED";
	}>;
	position: {
		latitude: number;
		longitude: number;
		atStop: boolean;
		type: "GPS" | "COMPUTED";
		recordedAt: string;
	};
	network: Network;
	operator?: Operator;
	vehicleRef?: string;
	serviceDate?: string;
	updatedAt: string;
};

export const registerVehicleJourneyRoutes = (hono: Hono, store: JourneyStore) =>
	hono.get(
		"/vehicle-journeys",
		/*createQueryValidator(getVehicleJourneysQuerySchema),*/ async (c) => {
			const journeys = store.values().toArray();

			const networkList = await database
				.select()
				.from(networks)
				.where(
					inArray(
						networks.ref,
						journeys.map(({ networkRef }) => networkRef),
					),
				);

			const operatorList = await database
				.select()
				.from(operators)
				.where(
					inArray(
						operators.ref,
						journeys.flatMap(({ operatorRef }) => operatorRef ?? []),
					),
				);

			const lineList = await database
				.select()
				.from(lines)
				.where(
					inArray(
						lines.ref,
						journeys.flatMap(({ line }) => line?.ref ?? []),
					),
				);

			return c.json({
				journeys: journeys.map((journey) => ({
					id: journey.id,
					line: lineList.find((line) => line.ref === journey.line?.ref),
					direction: journey.direction,
					destination: journey.destination,
					calls: journey.calls,
					position: journey.position,
					network: networkList.find(({ ref }) => ref === journey.networkRef)!,
					operator: operatorList.find(({ ref }) => ref === journey.operatorRef),
					vehicleRef: journey.vehicleRef,
					serviceDate: journey.serviceDate,
					updatedAt: journey.updatedAt,
				})) satisfies DisposeableVehicleJourney[],
				generatedAt: Temporal.Now.instant(),
			});
		},
	);
