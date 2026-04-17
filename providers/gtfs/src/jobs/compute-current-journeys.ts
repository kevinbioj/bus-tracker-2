import type { VehicleJourney, VehicleJourneyPath } from "@bus-tracker/contracts";
import { match, P } from "ts-pattern";
import { createPlainDate, createPlainTime, createZonedDateTime } from "../cache/temporal-cache.js";
import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import type { Gtfs } from "../model/gtfs.js";
import type { TripDescriptor, TripUpdate } from "../model/gtfs-rt.js";
import type { Journey, JourneyCall } from "../model/journey.js";
import type { Source } from "../model/source.js";
import { guessStartDate } from "../utils/guess-start-date.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";

/**
 * A faster version of Temporal.ZonedDateTime.toString({ timeZoneName: "never" })
 * using native Date and manual offset calculation.
 * To be removed whenever Temporal gets fast enough.
 */
const offsetStringCache = new Map<number, string>();
function fastFormatISO(epochMs: number, offsetMs: number): string {
	const date = new Date(epochMs + offsetMs);
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth() + 1;
	const d = date.getUTCDate();
	const hh = date.getUTCHours();
	const mm = date.getUTCMinutes();
	const ss = date.getUTCSeconds();

	let offsetStr = offsetStringCache.get(offsetMs);
	if (offsetStr === undefined) {
		const absOffset = Math.abs(offsetMs);
		const oH = Math.floor(absOffset / 3600000);
		const oM = Math.floor((absOffset % 3600000) / 60000);
		const sign = offsetMs >= 0 ? "+" : "-";
		offsetStr = sign + (oH < 10 ? `0${oH}` : oH) + ":" + (oM < 10 ? `0${oM}` : oM);
		offsetStringCache.set(offsetMs, offsetStr);
	}

	return (
		y +
		"-" +
		(m < 10 ? `0${m}` : m) +
		"-" +
		(d < 10 ? `0${d}` : d) +
		"T" +
		(hh < 10 ? `0${hh}` : hh) +
		":" +
		(mm < 10 ? `0${mm}` : mm) +
		":" +
		(ss < 10 ? `0${ss}` : ss) +
		offsetStr
	);
}

/**
 * Get the timezone offset in milliseconds for a given timezone at a specific epoch.
 * We cache this per journey to avoid repeated calculations.
 */
const offsetCache = new Map<string, number>();
function getTimeZoneOffsetMs(timeZone: string, epochMs: number): number {
	const cacheKey = `${timeZone}_${Math.floor(epochMs / 3600000)}`; // Cache hourly to handle DST transitions
	let offset = offsetCache.get(cacheKey);
	if (offset === undefined) {
		const dt = new Date(epochMs);
		const utcDate = new Date(dt.toLocaleString("en-US", { timeZone: "UTC" }));
		const tzDate = new Date(dt.toLocaleString("en-US", { timeZone }));
		offset = tzDate.getTime() - utcDate.getTime();
		offsetCache.set(cacheKey, offset);

		if (offsetCache.size > 1000) offsetCache.clear();
	}
	return offset;
}

const getCalls = (journey: Journey, at: Temporal.Instant, getAheadTime?: (journey: Journey) => number) => {
	const aheadTime = getAheadTime?.(journey) ?? 0;
	const atMs = at.epochMilliseconds;

	// Rejet rapide via les bornes précalculées, sans matérialiser le tableau calls.
	if (atMs + aheadTime * 1000 < journey.firstCallArrivalMs) return;
	if (atMs > journey.lastCallDepartureMs) return;

	// Le voyage est dans la fenêtre : on accède aux calls (matérialisation si nécessaire).
	const firstCall = journey.calls[0];
	if (
		firstCall === undefined ||
		atMs + aheadTime * 1000 < (firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime)
	)
		return;

	const lastCall = journey.calls[journey.calls.length - 1];
	if (lastCall === undefined || atMs > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime)) return;

	const getCallTime = (call: JourneyCall, index: number) =>
		index === journey.calls.length - 1
			? (call.expectedArrivalTime ?? call.aimedArrivalTime)
			: (call.expectedDepartureTime ?? call.aimedDepartureTime);

	// Chercher le dernier arrêt déjà desservi (heure <= maintenant).
	// Un arrêt ultérieur desservi en temps réel implique que tous les arrêts précédents l'ont été aussi,
	// même si leur heure théorique est encore dans le futur.
	const lastPassedIndex = journey.calls.findLastIndex((call, index) => atMs >= getCallTime(call, index));

	const firstCandidateIndex = lastPassedIndex + 1;
	if (firstCandidateIndex >= journey.calls.length) return;

	// Parmi les arrêts restants, le monitoredCall est celui dont l'heure est la plus petite.
	// Cela gère le cas d'une course en avance où un arrêt tardif (temps réel) a une heure
	// antérieure à l'heure théorique d'un arrêt précédent : afficher l'arrêt 2 à 13:12 puis
	// l'arrêt 3 à 13:11 serait incohérent, donc on commence directement à l'arrêt 3.
	let monitoredCallIndex = firstCandidateIndex;
	let minCallTime = getCallTime(journey.calls[firstCandidateIndex]!, firstCandidateIndex);
	for (let i = firstCandidateIndex + 1; i < journey.calls.length; i++) {
		const t = getCallTime(journey.calls[i]!, i);
		if (t < minCallTime) {
			minCallTime = t;
			monitoredCallIndex = i;
		}
	}

	return journey.calls.slice(monitoredCallIndex);
};

const createCallsFromTripUpdate = (gtfs: Gtfs, tripUpdate?: TripUpdate): JourneyCall[] | undefined => {
	if (tripUpdate?.stopTimeUpdate === undefined) return;
	if (tripUpdate.stopTimeUpdate.some(({ stopId }) => !gtfs.stops.has(stopId))) return;

	return tripUpdate.stopTimeUpdate.flatMap((stopTimeUpdate, index) => {
		if (typeof stopTimeUpdate.arrival?.time !== "number" && typeof stopTimeUpdate.departure?.time !== "number")
			return [];

		const stop = gtfs.stops.get(stopTimeUpdate.stopId)!;

		const arrivalTimeMs = (stopTimeUpdate?.arrival?.time ?? stopTimeUpdate.departure?.time)! * 1000;
		const departureTimeMs = (stopTimeUpdate?.departure?.time ?? stopTimeUpdate.arrival?.time)! * 1000;

		return {
			aimedArrivalTime: arrivalTimeMs,
			expectedArrivalTime: arrivalTimeMs,
			aimedDepartureTime: departureTimeMs,
			expectedDepartureTime: departureTimeMs,
			sequence: stopTimeUpdate.stopSequence ?? index,
			stop,
			platform: stopTimeUpdate.stopTimeProperties?.assignedStopId,
			status: "UNSCHEDULED",
			flags: [],
		};
	});
};

const getTripFromDescriptor = (gtfs: Gtfs, tripDescriptor: TripDescriptor, allowTripGuessing?: boolean) => {
	const trip = gtfs.trips.get(tripDescriptor.tripId);
	if (trip !== undefined) {
		if (tripDescriptor.routeId !== undefined && trip.route.id !== tripDescriptor.routeId) return;
		if (tripDescriptor.directionId !== undefined && trip.direction !== tripDescriptor.directionId) return;
		return trip;
	}

	if (
		allowTripGuessing &&
		tripDescriptor.routeId !== undefined &&
		tripDescriptor.startDate !== undefined &&
		tripDescriptor.startTime !== undefined &&
		gtfs.routes.has(tripDescriptor.routeId)
	) {
		const startDate = createPlainDate(tripDescriptor.startDate);

		const [hours, minutes, seconds] = tripDescriptor.startTime.split(":").map(Number);
		const startTimeModulus = Math.floor((hours ?? 0) / 24);
		const startTime = createPlainTime(
			`${String((hours ?? 0) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
		);

		const startsAt = createZonedDateTime(
			startDate.add({ days: startTimeModulus }),
			startTime,
			gtfs.routes.get(tripDescriptor.routeId)!.agency.timeZone,
		);

		if (startsAt.toInstant().since(Temporal.Now.instant()).total("minutes") >= 30) {
			return;
		}

		const matchingTrip = gtfs.trips.values().find((trip) => {
			if (trip.route.id !== tripDescriptor.routeId) return false;
			if (trip.direction !== (tripDescriptor.directionId ?? 0)) return false;
			if (!trip.service.runsOn(startDate)) return false;

			const firstStop = trip.stopTimes.at(0);
			if (firstStop === undefined) return false;

			const startTime = `${(firstStop.arrivalTime.hour + 24 * firstStop.arrivalModulus).toString().padStart(2, "0")}:${firstStop.arrivalTime.minute.toString().padStart(2, "0")}:${firstStop.arrivalTime.second.toString().padStart(2, "0")}`;
			return startTime === tripDescriptor.startTime;
		});

		return matchingTrip;
	}

	return trip;
};

// const matchJourneyToTripDescriptor = (journey: Journey, tripDescriptor: TripDescriptor) => {
// 	if (journey.trip.id !== tripDescriptor.tripId) return false;
// 	if (tripDescriptor.routeId !== undefined && journey.trip.route.id !== tripDescriptor.routeId) return false;
// 	if (tripDescriptor.directionId !== undefined && journey.trip.direction !== tripDescriptor.directionId) return false;
// 	if (tripDescriptor.startDate !== undefined && !journey.date.equals(tripDescriptor.startDate)) return false;
// 	return true;
// };

export async function computeVehicleJourneys(source: Source) {
	if (source.gtfs === undefined) return { journeys: [], paths: [] };

	const now = Temporal.Now.instant();
	const watch = createStopWatch();
	const sourceId = padSourceId(source);
	const updateLog = console.draft("%s     ► Generating active journeys list.", sourceId);

	try {
		updateLog("%s 1/2 ► Downloading real-time data from feeds.", sourceId);
		const { tripUpdates, vehiclePositions } = await downloadGtfsRt(source);
		const downloadTime = watch.step();

		updateLog("%s 2/2 ► Computing active journeys.", sourceId);
		const activeJourneys = new Map<string, VehicleJourney>();
		const paths = new Map<string, VehicleJourneyPath>();
		const handledJourneyIds = new Set<string>();
		const handledBlockIds = new Set<string>();

		if (tripUpdates.length > 0) {
			for (const tripUpdate of tripUpdates) {
				if (tripUpdate.trip.scheduleRelationship === "CANCELED") continue;

				const updatedAt = Temporal.Instant.fromEpochMilliseconds(tripUpdate.timestamp * 1000);

				const trip = getTripFromDescriptor(source.gtfs, tripUpdate.trip, source.options.allowTripGuessing);
				if (trip === undefined || trip.stopTimes.length < 2) continue;

				const firstStopTime = trip.stopTimes.at(0)!;
				const startDate =
					tripUpdate.trip.startDate !== undefined
						? Temporal.PlainDate.from(tripUpdate.trip.startDate)
						: guessStartDate(
								firstStopTime.arrivalTime,
								firstStopTime.arrivalModulus,
								updatedAt.toZonedDateTimeISO(trip.route.agency.timeZone),
							);

				let journey = source.gtfs.journeys.get(`${startDate.toString()}-${trip.id}`);
				if (journey === undefined) {
					journey = trip.getScheduledJourney(startDate, true);
					source.gtfs.journeys.set(`${startDate.toString()}-${trip.id}`, journey);
				}
				journey.updateJourney(tripUpdate.stopTimeUpdate ?? [], source.options.appendTripUpdateInformation);
				journey.setVehicleDescriptor(tripUpdate.vehicle, tripUpdate.timestamp * 1000);
			}

			// source.gtfs.journeys.sort((a, b) => {
			// 	const aStart = a.calls.at(0)!.expectedArrivalTime ?? a.calls.at(0)!.aimedArrivalTime;
			// 	const bStart = b.calls.at(0)!.expectedArrivalTime ?? b.calls.at(0)!.aimedArrivalTime;
			// 	return aStart - bStart;
			// });
		}

		for (const vehiclePosition of vehiclePositions) {
			// 👏 https://transport.data.gouv.fr/resources/81925
			if (vehiclePosition.position === undefined) continue;

			// nomad-car-geo3d patch
			if (source.id === "nomad-car-geo3d") {
				const tripUpdate = tripUpdates.find((tripUpdate) => tripUpdate.trip.tripId === vehiclePosition.trip?.tripId);
				if (tripUpdate !== undefined) {
					const nextStop = tripUpdate.stopTimeUpdate?.find(
						(stopTimeUpdate) =>
							stopTimeUpdate.scheduleRelationship === "SCHEDULED" && stopTimeUpdate.departure === undefined,
					);
					if (nextStop !== undefined) {
						vehiclePosition.currentStatus = "IN_TRANSIT_TO";
						vehiclePosition.currentStopSequence = nextStop.stopSequence;
						vehiclePosition.stopId = nextStop.stopId;
					}
				}
			}

			let journey: Journey | undefined;

			const updatedAt = Temporal.Instant.fromEpochMilliseconds(vehiclePosition.timestamp * 1000);

			if (vehiclePosition.trip !== undefined) {
				const trip = getTripFromDescriptor(source.gtfs, vehiclePosition.trip, source.options.allowTripGuessing);
				if (trip !== undefined) {
					const firstStopTime = trip.stopTimes.at(0);

					const startDate =
						vehiclePosition.trip.startDate !== undefined
							? Temporal.PlainDate.from(vehiclePosition.trip.startDate)
							: firstStopTime
								? guessStartDate(
										firstStopTime.arrivalTime,
										firstStopTime.arrivalModulus,
										updatedAt.toZonedDateTimeISO(trip.route.agency.timeZone),
									)
								: Temporal.Now.plainDateISO();

					journey = source.gtfs.journeys.get(`${startDate.toString()}-${trip.id}`);
					if (journey === undefined) {
						journey = trip.getScheduledJourney(startDate, true);
						source.gtfs.journeys.set(`${startDate.toString()}-${trip.id}`, journey);
					}

					const minutesSinceUpdate = (now.epochMilliseconds - updatedAt.epochMilliseconds) / 60000;
					if (minutesSinceUpdate >= 10) {
						const lastCall = journey.calls[journey.calls.length - 1]!;
						if (now.epochMilliseconds > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime)) {
							continue;
						}
					}
					handledJourneyIds.add(journey.id);
					if (journey.trip.block !== undefined) {
						handledBlockIds.add(journey.trip.block);
					}
				}
			}

			if (journey === undefined && (now.epochMilliseconds - updatedAt.epochMilliseconds) / 60000 >= 5) continue;

			const networkRef = source.options.getNetworkRef(journey, vehiclePosition.vehicle);
			const operatorRef = source.options.getOperatorRef?.(journey, vehiclePosition.vehicle);
			const vehicleRef =
				source.options.getVehicleRef !== undefined
					? source.options.getVehicleRef?.(vehiclePosition.vehicle, journey)
					: (vehiclePosition.vehicle.label ?? vehiclePosition.vehicle.id);

			const tripRef =
				journey !== undefined ? (source.options.mapTripRef?.(journey.trip.id) ?? journey.trip.id) : undefined;

			const calls =
				journey !== undefined
					? vehiclePosition.currentStopSequence !== undefined
						? journey.calls.slice(
								journey.calls.findIndex((call) => call.sequence >= vehiclePosition.currentStopSequence!),
							)
						: vehiclePosition.stopId !== undefined
							? (() => {
									const idx = journey.calls.findIndex((call) => call.stop.id === vehiclePosition.stopId);
									return idx !== -1 ? journey.calls.slice(idx) : getCalls(journey, now, () => Number.POSITIVE_INFINITY);
								})()
							: getCalls(journey, now, () => Number.POSITIVE_INFINITY)
					: createCallsFromTripUpdate(
							source.gtfs,
							tripUpdates.find((tripUpdate) => tripUpdate.trip.tripId === vehiclePosition.trip?.tripId),
						)?.filter(({ aimedDepartureTime }) => now.epochMilliseconds < aimedDepartureTime);

			const key = `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehiclePosition.vehicle.id}`;

			const pathRef =
				!source.options.disableRoutePaths && journey?.trip.shape !== undefined
					? `${networkRef}:RoutePath:${source.id}:${journey.trip.shape.id}`
					: undefined;

			if (pathRef !== undefined && !paths.has(pathRef)) {
				paths.set(pathRef, journey!.trip.shape!.asPath());
			}

			const timeZone = journey?.trip.route.agency.timeZone ?? "Europe/Paris";
			const offsetMs = getTimeZoneOffsetMs(timeZone, now.epochMilliseconds);

			const vehicleJourney: VehicleJourney = {
				id: key,
				line:
					journey !== undefined
						? {
								ref: `${networkRef}:Line:${
									source.options.mapLineRef?.(journey.trip.route.id) ?? journey.trip.route.id
								}`,
								number: journey.trip.route.name,
								type: journey.trip.route.type,
								color: journey.trip.route.color,
								textColor: journey.trip.route.textColor,
							}
						: vehiclePosition.trip?.routeId !== undefined
							? {
									ref: `${networkRef}:Line:${
										source.options.mapLineRef?.(vehiclePosition.trip.routeId) ?? vehiclePosition.trip.routeId
									}`,
									number: vehiclePosition.trip.routeId,
									type: "UNKNOWN",
								}
							: undefined,
				direction: (journey?.trip.direction ?? vehiclePosition.trip?.directionId) === 0 ? "OUTBOUND" : "INBOUND",
				calls:
					journey !== undefined || calls !== undefined
						? (calls?.map((call, index) => {
								const isLast = index === calls.length - 1;
								const aimedTimeMs = isLast ? call.aimedArrivalTime : call.aimedDepartureTime;
								const expectedTimeMs = isLast ? call.expectedArrivalTime : call.expectedDepartureTime;

								return {
									aimedTime: fastFormatISO(aimedTimeMs, offsetMs),
									expectedTime: expectedTimeMs ? fastFormatISO(expectedTimeMs, offsetMs) : undefined,
									stopRef: `${networkRef}:StopPoint:${source.options.mapStopRef?.(call.stop.id) ?? call.stop.id}`,
									stopName: call.stop.name,
									stopOrder: call.sequence,
									distanceTraveled: call.distanceTraveled,
									latitude: call.stop.latitude,
									longitude: call.stop.longitude,
									callStatus: call.status,
									flags: call.flags,
								};
							}) ?? [])
						: undefined,
				destination: source.options.getDestination?.(journey, vehiclePosition.vehicle) ?? journey?.trip.headsign,
				position: {
					latitude: vehiclePosition.position.latitude,
					longitude: vehiclePosition.position.longitude,
					bearing: vehiclePosition.position.bearing,
					atStop: vehiclePosition.currentStatus === "STOPPED_AT",
					type: "GPS",
					recordedAt: fastFormatISO(vehiclePosition.timestamp * 1000, offsetMs),
				},
				pathRef,
				occupancy: match(vehiclePosition.occupancyStatus)
					.with(P.union("EMPTY", "MANY_SEATS_AVAILABLE"), () => "LOW" as const)
					.with(P.union("FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY"), () => "MEDIUM" as const)
					.with(P.union("CRUSHED_STANDING_ROOM_ONLY", "FULL"), () => "HIGH" as const)
					.with(P.union("NOT_ACCEPTING_PASSENGERS", "NOT_BOARDABLE" as const), () => "NO_PASSENGERS" as const)
					.otherwise(() => undefined),
				journeyRef: journey !== undefined ? `${networkRef}:ServiceJourney:${tripRef}` : undefined,
				networkRef,
				operatorRef,
				vehicleRef: vehicleRef !== undefined ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
				serviceDate: journey?.date.toString(),
				updatedAt: updatedAt.toString(),
			};

			if (source.options.isValidJourney === undefined || source.options.isValidJourney(vehicleJourney)) {
				activeJourneys.set(key, vehicleJourney);
			}
		}

		if (source.options.mode !== "VP-ONLY") {
			const nowStr = now.toString();
			for (const journey of source.gtfs.journeys.values()) {
				if (handledJourneyIds.has(journey.id)) continue;
				if (journey.trip.block !== undefined && handledBlockIds.has(journey.trip.block)) continue;

				const vehicleDescriptor = journey.vehicleDescriptor;

				const networkRef = source.options.getNetworkRef(journey);
				const operatorRef = source.options.getOperatorRef?.(journey, vehicleDescriptor);
				const tripRef = source.options.mapTripRef?.(journey.trip.id) ?? journey.trip.id;

				if (journey.hasRealtime()) {
					if (source.options.mode === "NO-TU") continue;
				} else {
					if (source.options.excludeScheduled === true) continue;
					if (typeof source.options.excludeScheduled === "function" && source.options.excludeScheduled?.(journey.trip))
						continue;
				}

				const key =
					vehicleDescriptor !== undefined
						? `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehicleDescriptor.id}`
						: journey.trip.block !== undefined
							? `${networkRef}:${operatorRef ?? ""}:ServiceBlock:${journey.trip.block}:${journey.date}`
							: `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${tripRef}:${journey.date}`;

				if (activeJourneys.has(key)) continue;

				const calls = getCalls(journey, now, source.options.getAheadTime);
				if (calls === undefined || calls.length === 0) continue;

				const vehicleRef =
					source.options.getVehicleRef !== undefined
						? source.options.getVehicleRef(vehicleDescriptor, journey)
						: (vehicleDescriptor?.label ?? vehicleDescriptor?.id);

				if (journey.trip.block !== undefined) {
					handledBlockIds.add(journey.trip.block);
				}

				const pathRef =
					!source.options.disableRoutePaths && journey?.trip.shape !== undefined
						? `${networkRef}:RoutePath:${source.id}:${journey.trip.shape.id}`
						: undefined;

				if (pathRef !== undefined && !paths.has(pathRef)) {
					paths.set(pathRef, journey!.trip.shape!.asPath());
				}

				const timeZone = journey.trip.route.agency.timeZone;
				const offsetMs = getTimeZoneOffsetMs(timeZone, now.epochMilliseconds);

				const vehicleJourney: VehicleJourney = {
					id: key,
					line: {
						ref: `${networkRef}:Line:${source.options.mapLineRef?.(journey.trip.route.id) ?? journey.trip.route.id}`,
						number: journey.trip.route.name,
						type: journey.trip.route.type,
						color: journey.trip.route.color,
						textColor: journey.trip.route.textColor,
					},
					direction: journey.trip.direction === 0 ? "OUTBOUND" : "INBOUND",
					destination: source.options.getDestination?.(journey, vehicleDescriptor) ?? journey.trip.headsign,
					calls: calls.map((call, index) => {
						const isLast = index === calls.length - 1;
						const aimedTimeMs = isLast ? call.aimedArrivalTime : call.aimedDepartureTime;
						const expectedTimeMs = isLast ? call.expectedArrivalTime : call.expectedDepartureTime;

						return {
							aimedTime: fastFormatISO(aimedTimeMs, offsetMs),
							expectedTime: expectedTimeMs ? fastFormatISO(expectedTimeMs, offsetMs) : undefined,
							stopRef: `${networkRef}:StopPoint:${source.options.mapStopRef?.(call.stop.id) ?? call.stop.id}`,
							stopName: call.stop.name,
							stopOrder: call.sequence,
							distanceTraveled: call.distanceTraveled,
							latitude: call.stop.latitude,
							longitude: call.stop.longitude,
							platformName: call.platform,
							callStatus: call.status,
							flags: call.flags,
						};
					}),
					position: journey.guessPosition(now),
					pathRef,
					journeyRef: `${networkRef}:ServiceJourney:${tripRef}`,
					networkRef,
					operatorRef,
					vehicleRef: vehicleRef !== undefined ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
					serviceDate: journey.date.toString(),
					updatedAt: nowStr,
				};

				if (source.options.isValidJourney === undefined || source.options.isValidJourney(vehicleJourney)) {
					activeJourneys.set(key, vehicleJourney);
				}
			}
		}

		// Libère les calls des voyages terminés sans RT. Les voyages actifs/futurs conservent
		// leur cache pour éviter de re-calculer computeCallsForDate() à chaque cycle.
		const nowMs = now.epochMilliseconds;
		for (const journey of source.gtfs!.journeys.values()) {
			journey.releaseUnmodifiedCalls(nowMs);
		}

		const computeTime = watch.step();
		updateLog(
			"%s     ✓ Computed %d journeys and %d paths in %dms (%dms download - %dms compute).",
			sourceId,
			activeJourneys.size,
			paths.size,
			watch.total(),
			downloadTime,
			computeTime,
		);

		return {
			journeys: Array.from(activeJourneys.values()),
			paths: Object.fromEntries(paths),
		};
	} catch (cause) {
		updateLog("%s     ✘ Something wrong occurred during computation.", sourceId);
		throw new Error(`Failed to compute vehicle journeys for '${source.id}'.`, {
			cause,
		});
	}
}
