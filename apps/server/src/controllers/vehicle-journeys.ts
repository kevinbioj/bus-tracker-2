import { arrayOverlaps, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { database } from "../database/database.js";
import { lines, networks, operators, vehicles } from "../database/schema.js";
import { createQueryValidator } from "../helpers/validator-helpers.js";
import type { JourneyStore } from "../store/journey-store.js";

const getVehicleJourneysQuerySchema = z.object({
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
});

type DisposeableVehicleJourney = {
	id: string;
	lineId?: number;
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
	networkId: number;
	operatorId?: number;
	vehicle?: { id?: number; number: string };
	serviceDate?: string;
	updatedAt: string;
};

export const registerVehicleJourneyRoutes = (hono: Hono, store: JourneyStore) =>
	hono.get("/vehicle-journeys", createQueryValidator(getVehicleJourneysQuerySchema), async (c) => {
		const { swLat, swLon, neLat, neLon } = c.req.valid("query");

		const journeys = store
			.values()
			.filter((journey) => {
				const { latitude, longitude } = journey.position;
				return swLat <= latitude && latitude <= neLat && swLon <= longitude && longitude <= neLon;
			})
			.toArray();

		const networkList = await database
			.select({ id: networks.id, ref: networks.ref })
			.from(networks)
			.where(
				inArray(
					networks.ref,
					journeys.map(({ networkRef }) => networkRef),
				),
			);

		const operatorList = await database
			.select({ id: operators.id, ref: operators.ref })
			.from(operators)
			.where(
				inArray(
					operators.ref,
					journeys.flatMap(({ operatorRef }) => operatorRef ?? []),
				),
			);

		const lineList = journeys.some((journey) => typeof journey.line !== "undefined")
			? await database
					.select({ id: lines.id, references: lines.references })
					.from(lines)
					.where(
						arrayOverlaps(
							lines.references,
							journeys.flatMap(({ line }) => line?.ref ?? []),
						),
					)
			: [];

		const vehicleList = await database
			.select({ id: vehicles.id, ref: vehicles.ref, number: vehicles.number })
			.from(vehicles)
			.where(
				inArray(
					vehicles.ref,
					journeys.flatMap(({ vehicleRef }) => vehicleRef ?? []),
				),
			);

		return c.json({
			journeys: journeys.map((journey) => {
				const vehicle = vehicleList.find(({ ref }) => ref === journey.vehicleRef);
				return {
					id: journey.id,
					lineId: lineList.find(({ references }) => references?.some((ref) => ref === journey.line?.ref))?.id,
					direction: journey.direction,
					destination: journey.destination,
					calls: journey.calls,
					position: journey.position,
					networkId: networkList.find(({ ref }) => ref === journey.networkRef)!.id,
					operatorId: operatorList.find(({ ref }) => ref === journey.operatorRef)?.id,
					vehicle:
						typeof journey.vehicleRef !== "undefined"
							? {
									id: vehicle?.id,
									number: vehicle?.number ?? journey.vehicleRef.split(":")[3]!,
								}
							: undefined,
					serviceDate: journey.serviceDate,
					updatedAt: journey.updatedAt,
				};
			}) satisfies DisposeableVehicleJourney[],
			generatedAt: Temporal.Now.instant(),
		});
	});
