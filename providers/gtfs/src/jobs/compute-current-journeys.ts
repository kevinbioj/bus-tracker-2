import type { VehicleJourney } from "@bus-tracker/contracts";
import { Temporal } from "temporal-polyfill";
import { match, P } from "ts-pattern";

import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import type { Gtfs } from "../model/gtfs.js";
import type { TripDescriptor, TripUpdate } from "../model/gtfs-rt.js";
import type { Journey, JourneyCall } from "../model/journey.js";
import type { Source } from "../model/source.js";
import { guessStartDate } from "../utils/guess-start-date.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";

const getCalls = (journey: Journey, at: Temporal.Instant, getAheadTime?: (journey: Journey) => number) => {
	const aheadTime = getAheadTime?.(journey) ?? 0;

	const firstCall = journey.calls.at(0);
	if (
		typeof firstCall === "undefined" ||
		at.epochMilliseconds + aheadTime * 1000 <
			(firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime).epochMilliseconds
	)
		return;

	const lastCall = journey.calls.at(-1);
	if (
		typeof lastCall === "undefined" ||
		at.epochMilliseconds > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).epochMilliseconds
	)
		return;

	const ongoingCalls = journey.calls.filter((call, index) => {
		return index === journey.calls.length - 1
			? at.epochMilliseconds < (call.expectedArrivalTime ?? call.aimedArrivalTime).epochMilliseconds
			: at.epochMilliseconds < (call.expectedDepartureTime ?? call.aimedDepartureTime).epochMilliseconds;
	});
	if (ongoingCalls.length === 0) return;
	return ongoingCalls;
};

const createCallsFromTripUpdate = (gtfs: Gtfs, tripUpdate?: TripUpdate): JourneyCall[] | undefined => {
	if (typeof tripUpdate?.stopTimeUpdate === "undefined") return;
	if (tripUpdate.stopTimeUpdate.some(({ stopId }) => !gtfs.stops.has(stopId))) return;

	const timeZone =
		gtfs.trips.values().next().value?.route.agency.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

	return tripUpdate.stopTimeUpdate.flatMap((stopTimeUpdate, index) => {
		if (typeof stopTimeUpdate.arrival?.time !== "number" && typeof stopTimeUpdate.departure?.time !== "number")
			return [];

		const stop = gtfs.stops.get(stopTimeUpdate.stopId)!;

		const arrivalTime = Temporal.Instant.fromEpochMilliseconds(
			(stopTimeUpdate.arrival ?? stopTimeUpdate.departure)!.time! * 1000,
		).toZonedDateTimeISO(timeZone);
		const departureTime = Temporal.Instant.fromEpochMilliseconds(
			(stopTimeUpdate.departure ?? stopTimeUpdate.arrival)!.time! * 1000,
		).toZonedDateTimeISO(timeZone);

		return {
			aimedArrivalTime: arrivalTime,
			expectedArrivalTime: arrivalTime,
			aimedDepartureTime: departureTime,
			expectedDepartureTime: departureTime,
			sequence: stopTimeUpdate.stopSequence ?? index,
			stop,
			platform: stopTimeUpdate.stopTimeProperties?.assignedStopId,
			status: "UNSCHEDULED",
			flags: [],
		};
	});
};

const getTripFromDescriptor = (gtfs: Gtfs, tripDescriptor: TripDescriptor) => {
	const trip = gtfs.trips.get(tripDescriptor.tripId);
	if (typeof trip !== "undefined") {
		if (typeof tripDescriptor.routeId !== "undefined" && trip.route.id !== tripDescriptor.routeId) return;
		if (typeof tripDescriptor.directionId !== "undefined" && trip.direction !== tripDescriptor.directionId) return;
		return trip;
	}

	// if (
	// 	typeof tripDescriptor.routeId !== "undefined" &&
	// 	typeof tripDescriptor.startDate !== "undefined" &&
	// 	typeof tripDescriptor.startTime !== "undefined"
	// ) {
	// 	const matchingTrip = gtfs.trips.values().find((trip) => {
	// 		if (trip.route.id !== tripDescriptor.routeId) return false;
	// 		if (trip.direction !== (tripDescriptor.directionId ?? 0)) return false;
	// 		if (!trip.service.runsOn(Temporal.PlainDate.from(tripDescriptor.startDate!))) return false;

	// 		const firstStop = trip.stopTimes.at(0);
	// 		if (typeof firstStop === "undefined") return false;

	// 		const startTime = `${(firstStop.arrivalTime.hour + 24 * firstStop.arrivalModulus).toString().padStart(2, "0")}:${firstStop.arrivalTime.minute.toString().padStart(2, "0")}:${firstStop.arrivalTime.second.toString().padStart(2, "0")}`;
	// 		return startTime === tripDescriptor.startTime;
	// 	});

	// 	return matchingTrip;
	// }

	return trip;
};

const matchJourneyToTripDescriptor = (journey: Journey, tripDescriptor: TripDescriptor) => {
	if (journey.trip.id !== tripDescriptor.tripId) return false;
	if (typeof tripDescriptor.routeId !== "undefined" && journey.trip.route.id !== tripDescriptor.routeId) return false;
	if (typeof tripDescriptor.directionId !== "undefined" && journey.trip.direction !== tripDescriptor.directionId)
		return false;
	if (typeof tripDescriptor.startDate !== "undefined" && !journey.date.equals(tripDescriptor.startDate)) return false;
	return true;
};

export async function computeVehicleJourneys(source: Source): Promise<VehicleJourney[]> {
	if (typeof source.gtfs === "undefined") return [];

	const now = Temporal.Now.instant();
	const watch = createStopWatch();
	const sourceId = padSourceId(source);
	const updateLog = console.draft("%s     ► Generating active journeys list.", sourceId);

	try {
		updateLog("%s 1/2 ► Downloading real-time data from feeds.", sourceId);
		const { tripUpdates, vehiclePositions } = await downloadGtfsRt(
			source.options.realtimeResourceHrefs ?? [],
			source.options.mapTripUpdate,
			source.options.mapVehiclePosition,
		);
		const downloadTime = watch.step();

		updateLog("%s 2/2 ► Computing active journeys.", sourceId);
		const activeJourneys = new Map<string, VehicleJourney>();
		const handledJourneyIds = new Set<string>();
		const handledBlockIds = new Set<string>();

		if (tripUpdates.length > 0) {
			for (const tripUpdate of tripUpdates) {
				if (tripUpdate.trip.scheduleRelationship === "CANCELED") continue;

				const updatedAt = Temporal.Instant.fromEpochMilliseconds(tripUpdate.timestamp * 1000);

				const trip = getTripFromDescriptor(source.gtfs, tripUpdate.trip);
				if (typeof trip === "undefined") continue;
				const firstStopTime = trip.stopTimes.at(0)!;

				const startDate =
					typeof tripUpdate.trip.startDate !== "undefined"
						? Temporal.PlainDate.from(tripUpdate.trip.startDate)
						: guessStartDate(
								firstStopTime.arrivalTime,
								firstStopTime.arrivalModulus,
								updatedAt.toZonedDateTimeISO(trip.route.agency.timeZone),
							);

				let journey = source.gtfs.journeys.get(`${startDate.toString()}-${trip.id}`);
				if (typeof journey === "undefined") {
					journey = trip.getScheduledJourney(startDate, true);
					source.gtfs.journeys.set(`${startDate.toString()}-${trip.id}`, journey);
				}
				journey.updateJourney(tripUpdate.stopTimeUpdate ?? []);
			}

			// source.gtfs.journeys.sort((a, b) => {
			// 	const aStart = a.calls.at(0)!.expectedArrivalTime ?? a.calls.at(0)!.aimedArrivalTime;
			// 	const bStart = b.calls.at(0)!.expectedArrivalTime ?? b.calls.at(0)!.aimedArrivalTime;
			// 	return aStart.epochMilliseconds - bStart.epochMilliseconds;
			// });
		}

		for (const vehiclePosition of vehiclePositions) {
			// 👏 https://transport.data.gouv.fr/resources/81925
			if (typeof vehiclePosition.position === "undefined") continue;

			let journey: Journey | undefined;

			const updatedAt = Temporal.Instant.fromEpochMilliseconds(vehiclePosition.timestamp * 1000);

			if (typeof vehiclePosition.trip !== "undefined") {
				const trip = getTripFromDescriptor(source.gtfs, vehiclePosition.trip);
				if (typeof trip !== "undefined") {
					const firstStopTime = trip.stopTimes.at(0)!;

					const startDate =
						typeof vehiclePosition.trip.startDate !== "undefined"
							? Temporal.PlainDate.from(vehiclePosition.trip.startDate)
							: guessStartDate(
									firstStopTime.arrivalTime,
									firstStopTime.arrivalModulus,
									updatedAt.toZonedDateTimeISO(trip.route.agency.timeZone),
								);

					journey = source.gtfs.journeys.get(`${startDate.toString()}-${trip.id}`);
					if (typeof journey === "undefined") {
						journey = trip.getScheduledJourney(startDate, true);
						source.gtfs.journeys.set(`${startDate.toString()}-${trip.id}`, journey);
					}

					if (
						now.since(Temporal.Instant.fromEpochMilliseconds(vehiclePosition.timestamp * 1000)).total("minutes") >= 10
					) {
						const lastCall = journey.calls.at(-1)!;
						if (
							Temporal.Instant.compare(now, (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).toInstant())
						) {
							continue;
						}
					}
					handledJourneyIds.add(journey.id);
					if (typeof journey.trip.block !== "undefined") {
						handledBlockIds.add(journey.trip.block);
					}
				}
			}

			if (typeof journey === "undefined" && now.since(updatedAt).total("minutes") >= 5) continue;

			const networkRef = source.options.getNetworkRef(journey, vehiclePosition.vehicle);
			const operatorRef = source.options.getOperatorRef?.(journey, vehiclePosition.vehicle);
			const vehicleRef =
				typeof source.options.getVehicleRef !== "undefined"
					? source.options.getVehicleRef?.(vehiclePosition.vehicle, journey)
					: (vehiclePosition.vehicle.label ?? vehiclePosition.vehicle.id);

			const tripRef =
				typeof journey !== "undefined" ? (source.options.mapTripRef?.(journey.trip.id) ?? journey.trip.id) : undefined;

			const calls =
				typeof journey !== "undefined"
					? typeof vehiclePosition.currentStopSequence !== "undefined"
						? journey.calls.filter((call) => call.sequence >= vehiclePosition.currentStopSequence!)
						: typeof vehiclePosition.stopId !== "undefined" &&
								journey.calls.some(({ stop }) => stop.id === vehiclePosition.stopId)
							? journey.calls.slice(journey.calls.findIndex((call) => call.stop.id === vehiclePosition.stopId))
							: getCalls(journey, now, () => Number.POSITIVE_INFINITY)
					: createCallsFromTripUpdate(
							source.gtfs,
							tripUpdates.find((tripUpdate) => tripUpdate.trip.tripId === vehiclePosition.trip?.tripId),
						)?.filter(({ aimedDepartureTime }) => Temporal.Instant.compare(now, aimedDepartureTime.toInstant()) < 0);

			const key = `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehiclePosition.vehicle.id}`;

			const vehicleJourney: VehicleJourney = {
				id: key,
				line:
					typeof journey !== "undefined"
						? {
								ref: `${networkRef}:Line:${
									source.options.mapLineRef?.(journey.trip.route.id) ?? journey.trip.route.id
								}`,
								number: journey.trip.route.name,
								type: journey.trip.route.type,
								color: journey.trip.route.color,
								textColor: journey.trip.route.textColor,
							}
						: typeof vehiclePosition.trip?.routeId !== "undefined"
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
					typeof journey !== "undefined" || typeof calls !== "undefined"
						? (calls?.map((call, index) => {
								const isLast = index === calls.length - 1;
								return {
									aimedTime: (isLast ? call.aimedArrivalTime : call.aimedDepartureTime).toString({
										timeZoneName: "never",
									}),
									expectedTime: (isLast ? call.expectedArrivalTime : call.expectedDepartureTime)?.toString({
										timeZoneName: "never",
									}),
									stopRef: `${networkRef}:StopPoint:${source.options.mapStopRef?.(call.stop.id) ?? call.stop.id}`,
									stopName: call.stop.name,
									stopOrder: call.sequence,
									callStatus: call.status,
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
					recordedAt: Temporal.Instant.fromEpochMilliseconds(vehiclePosition.timestamp * 1000)
						.toZonedDateTimeISO(journey?.trip.route.agency.timeZone ?? "Europe/Paris")
						.toString({ timeZoneName: "never" }),
				},
				occupancy: match(vehiclePosition.occupancyStatus)
					.with(P.union("EMPTY", "MANY_SEATS_AVAILABLE"), () => "LOW" as const)
					.with(P.union("FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY"), () => "MEDIUM" as const)
					.with(P.union("CRUSHED_STANDING_ROOM_ONLY", "FULL"), () => "HIGH" as const)
					.with(P.union("NOT_ACCEPTING_PASSENGERS", "NOT_BOARDABLE" as const), () => "NO_PASSENGERS" as const)
					.otherwise(() => undefined),
				journeyRef: typeof journey !== "undefined" ? `${networkRef}:ServiceJourney:${tripRef}` : undefined,
				networkRef,
				operatorRef,
				vehicleRef:
					typeof vehicleRef !== "undefined" ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
				serviceDate: journey?.date.toString(),
				updatedAt: Temporal.Instant.fromEpochMilliseconds(vehiclePosition.timestamp * 1000).toString(),
			};

			if (typeof source.options.isValidJourney === "undefined" || source.options.isValidJourney(vehicleJourney)) {
				activeJourneys.set(key, vehicleJourney);
			}
		}

		if (source.options.mode !== "VP-ONLY") {
			for (const journey of source.gtfs.journeys.values()) {
				if (handledJourneyIds.has(journey.id)) continue;
				if (typeof journey.trip.block !== "undefined" && handledBlockIds.has(journey.trip.block)) continue;

				const vehicleDescriptor = tripUpdates.find((tu) => matchJourneyToTripDescriptor(journey, tu.trip))?.vehicle;

				const networkRef = source.options.getNetworkRef(journey);
				const operatorRef = source.options.getOperatorRef?.(journey, vehicleDescriptor);
				const vehicleRef =
					typeof source.options.getVehicleRef !== "undefined"
						? source.options.getVehicleRef(vehicleDescriptor, journey)
						: (vehicleDescriptor?.label ?? vehicleDescriptor?.id);
				const tripRef = source.options.mapTripRef?.(journey.trip.id) ?? journey.trip.id;

				if (journey.hasRealtime()) {
					if (source.options.mode === "NO-TU") continue;
				} else {
					if (source.options.excludeScheduled === true) continue;
					if (typeof source.options.excludeScheduled === "function" && source.options.excludeScheduled?.(journey.trip))
						continue;
				}

				const key =
					typeof vehicleDescriptor !== "undefined"
						? `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehicleDescriptor.id}`
						: typeof journey.trip.block !== "undefined"
							? `${networkRef}:${operatorRef ?? ""}:ServiceBlock:${journey.trip.block}:${journey.date}`
							: `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${tripRef}:${journey.date}`;

				if (activeJourneys.has(key)) continue;

				const calls = getCalls(journey, now, source.options.getAheadTime);
				if (typeof calls === "undefined" || calls.length < 2) continue;

				if (typeof journey.trip.block !== "undefined") {
					handledBlockIds.add(journey.trip.block);
				}

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
						return {
							aimedTime: (isLast ? call.aimedArrivalTime : call.aimedDepartureTime).toString({ timeZoneName: "never" }),
							expectedTime: (isLast ? call.expectedArrivalTime : call.expectedDepartureTime)?.toString({
								timeZoneName: "never",
							}),
							stopRef: `${networkRef}:StopPoint:${source.options.mapStopRef?.(call.stop.id) ?? call.stop.id}`,
							stopName: call.stop.name,
							stopOrder: call.sequence,
							platformName: call.platform,
							callStatus: call.status,
							flags: call.flags,
						};
					}),
					position: journey.guessPosition(now),
					journeyRef: `${networkRef}:ServiceJourney:${tripRef}`,
					networkRef,
					operatorRef,
					vehicleRef:
						typeof vehicleRef !== "undefined" ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
					serviceDate: journey.date.toString(),
					updatedAt: now.toString(),
				};

				if (typeof source.options.isValidJourney === "undefined" || source.options.isValidJourney(vehicleJourney)) {
					activeJourneys.set(key, vehicleJourney);
				}
			}
		}

		const computeTime = watch.step();
		updateLog(
			"%s     ✓ Computed %d journeys in %dms (%dms download - %dms compute).",
			sourceId,
			activeJourneys.size,
			watch.total(),
			downloadTime,
			computeTime,
		);
		return Array.from(activeJourneys.values());
	} catch (cause) {
		updateLog("%s     ✘ Something wrong occurred during computation.", sourceId);
		throw new Error(`Failed to compute vehicle journeys for '${source.id}'.`, {
			cause,
		});
	}
}
