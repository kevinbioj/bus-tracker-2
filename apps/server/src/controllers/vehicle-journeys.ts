import { getVehicleJourneyPositionType, type VehicleJourneyPaths } from "@bus-tracker/contracts";
import { eq, inArray } from "drizzle-orm";
import * as z from "zod";

import { database } from "../core/database/database.js";
import { linesTable, vehiclesTable } from "../core/database/schema.js";
import { findGirouette } from "../core/services/girouette-service.js";
import { journeyStore } from "../core/store/journey-store.js";
import { redis } from "../index.js";
import { hono } from "../server.js";
import { keyBy } from "../utils/key-by.js";
import { createParamValidator, createQueryValidator } from "../utils/validator-helpers.js";

const getVehicleJourneyMarkersQuery = z.object({
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
	includeMarker: z.string().optional(),
	excludeScheduled: z.coerce.boolean().optional(),
	// Absent = aucun filtrage pays, pour rester compatible avec les clients existants.
	countryCodes: z
		.string()
		.optional()
		.transform((value) => (value !== undefined ? value.split(",").filter((code) => code.length > 0) : undefined))
		.transform((codes) => (codes !== undefined && codes.length > 0 ? new Set(codes) : undefined)),
	positionTypes: z
		.string()
		.optional()
		.transform((value) => (value !== undefined ? value.split(",") : undefined))
		.pipe(z.array(z.enum(["GPS", "ESTIMATED", "SCHEDULED"])).optional()),
	networkId: z
		.union([z.coerce.number(), z.array(z.coerce.number())])
		.optional()
		.transform((values) => (typeof values === "number" ? [values] : values)),
	lineId: z
		.union([z.coerce.number(), z.array(z.coerce.number())])
		.optional()
		.transform((values) => (typeof values === "number" ? [values] : values)),
});

hono.get("/vehicle-journeys/markers", createQueryValidator(getVehicleJourneyMarkersQuery), async (c) => {
	const {
		swLat,
		swLon,
		neLat,
		neLon,
		includeMarker,
		excludeScheduled,
		positionTypes,
		lineId,
		networkId,
		countryCodes,
	} = c.req.valid("query");

	const boundedLineIds = new Set<number>();
	const boundedJourneys = journeyStore
		.values()
		.filter((journey) => {
			if (countryCodes !== undefined && !countryCodes.has(journey.countryCode)) {
				return false;
			}

			if (positionTypes !== undefined) {
				if (!positionTypes.includes(getVehicleJourneyPositionType(journey))) {
					return false;
				}
			} else if (excludeScheduled && getVehicleJourneyPositionType(journey) === "SCHEDULED") {
				return false;
			}

			if (Array.isArray(lineId)) {
				if (journey.lineId === undefined || !lineId.includes(journey.lineId)) {
					return false;
				}

				boundedLineIds.add(journey.lineId);
				return true;
			}

			if (Array.isArray(networkId)) {
				if (journey.networkId === undefined || !networkId.includes(journey.networkId)) {
					return false;
				}

				if (journey.lineId !== undefined) {
					boundedLineIds.add(journey.lineId);
				}

				return true;
			}

			const { latitude, longitude } = journey.position;
			const isWithin = swLat <= latitude && latitude <= neLat && swLon <= longitude && longitude <= neLon;

			if (!isWithin) {
				return false;
			}

			if (journey.lineId !== undefined) {
				boundedLineIds.add(journey.lineId);
			}

			return true;
		})
		.toArray();

	if (includeMarker !== undefined && !boundedJourneys.some((journey) => journey.id === includeMarker)) {
		const additionalJourney = journeyStore.get(includeMarker);
		if (additionalJourney !== undefined) {
			boundedJourneys.push(additionalJourney);
			if (additionalJourney.lineId !== undefined) {
				boundedLineIds.add(additionalJourney.lineId);
			}
		}
	}

	const lines = keyBy(
		await database
			.select()
			.from(linesTable)
			.where(inArray(linesTable.id, Array.from(boundedLineIds))),
		(line) => line.id,
	);

	const items = boundedJourneys.map(({ id, lineId, position, vehicle }) => {
		const { latitude, longitude, bearing, type } = position;
		const line = lineId ? lines.get(lineId) : undefined;
		return {
			id,
			lineNumber: line?.number,
			vehicleNumber: vehicle?.number,
			color: line?.textColor ? `#${line.textColor}` : undefined,
			fillColor: line?.color ? `#${line.color}` : undefined,
			position: { latitude, longitude, bearing, type },
		};
	});

	return c.json({
		items,
		at: Temporal.Now.instant(),
	});
});

const getVehicleJourneyParams = z.object({
	id: z.string(),
});

hono.get("/vehicle-journeys/:id", createParamValidator(getVehicleJourneyParams), async (c) => {
	const { id } = c.req.valid("param");

	const journey = journeyStore.get(id);
	if (journey === undefined) {
		c.status(404);
		return c.json({ error: `No journey was found with id "${id}".` });
	}

	const vehicle = journey.vehicle?.id
		? (
				await database
					.select({
						type: vehiclesTable.type,
						designation: vehiclesTable.designation,
						airConditioning: vehiclesTable.airConditioning,
						usbPorts: vehiclesTable.usbPorts,
					})
					.from(vehiclesTable)
					.where(eq(vehiclesTable.id, journey.vehicle.id))
			).at(0)
		: undefined;

	const girouette = await findGirouette({
		networkId: journey.networkId,
		lineId: journey.lineId,
		directionId: journey.direction === "OUTBOUND" ? 0 : 1,
		destination: journey.destination ?? journey.calls?.findLast((call) => call.callStatus !== "SKIPPED")?.stopName,
	});

	// La référence du tracé abandonné reste interne : les deux tracés de la course sont servis
	// ensemble par `/vehicle-journeys/:id/paths`, le client n'a pas à la connaître.
	const { cancelledPathRef, ...exposedJourney } = journey;

	return c.json({
		...exposedJourney,
		vehicle: journey.vehicle
			? {
					...journey.vehicle,
					type: vehicle?.type ?? undefined,
					designation: vehicle?.designation ?? undefined,
					airConditioning: vehicle?.airConditioning ?? undefined,
					usbPorts: vehicle?.usbPorts ?? undefined,
				}
			: undefined,
		girouette: girouette?.data,
	});
});

/**
 * Tracés d'une course en un seul appel : celui qu'elle suit, et les portions que sa déviation lui
 * fait abandonner. `/paths/:ref` reste servie pour les clients qui ne connaissent que le premier.
 */
hono.get("/vehicle-journeys/:id/paths", createParamValidator(getVehicleJourneyParams), async (c) => {
	const { id } = c.req.valid("param");

	const journey = journeyStore.get(id);
	if (journey === undefined) return c.json({ error: `No journey was found with id "${id}".` }, 404);
	if (journey.pathRef === undefined) return c.json({ error: `Journey "${id}" has no path.` }, 404);

	if (!redis.isReady) return c.json({ error: "Paths are temporarily unavailable." }, 503);

	const refs = journey.cancelledPathRef !== undefined ? [journey.pathRef, journey.cancelledPathRef] : [journey.pathRef];
	const [rawPath, rawCancelledPath] = await redis.mGet(refs);

	// Les tracés expirent d'eux-mêmes : une course encore suivie peut en avoir perdu le sien si son
	// producteur a cessé de le republier.
	if (rawPath === null || rawPath === undefined) {
		return c.json({ error: `No path was found for journey "${id}".` }, 404);
	}

	const paths: VehicleJourneyPaths = { path: JSON.parse(rawPath) };
	if (rawCancelledPath !== null && rawCancelledPath !== undefined) {
		paths.cancelled = JSON.parse(rawCancelledPath);
	}

	return c.json(paths);
});

const getPathParams = z.object({
	ref: z.string(),
});

hono.get("/paths/:ref", createParamValidator(getPathParams), async (c) => {
	const { ref } = c.req.valid("param");

	if (!redis.isReady) return c.json({ error: "Paths are temporarily unavailable." }, 503);

	const rawPath = await redis.get(ref);
	if (rawPath === null) {
		c.status(404);
		return c.json({ error: `No path was found with ref "${ref}".` });
	}

	return c.json(JSON.parse(rawPath));
});
