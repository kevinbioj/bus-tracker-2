import type { VehicleJourney } from "@bus-tracker/contracts";
import { Temporal } from "temporal-polyfill";

import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import type { TripDescriptor, TripUpdate } from "../model/gtfs-rt.js";
import type { Gtfs } from "../model/gtfs.js";
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
		at.epochSeconds + aheadTime < (firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime).epochSeconds
	)
		return;

	const lastCall = journey.calls.at(-1);
	if (
		typeof lastCall === "undefined" ||
		at.epochSeconds > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).epochSeconds
	)
		return;

	const ongoingCalls = journey.calls.filter((call, index) => {
		return index === journey.calls.length - 1
			? at.epochSeconds < (call.expectedArrivalTime ?? call.aimedArrivalTime).epochSeconds
			: at.epochSeconds < (call.expectedDepartureTime ?? call.aimedDepartureTime).epochSeconds;
	});
	if (ongoingCalls.length === 0) return;
	return ongoingCalls;
};

const createCallsFromTripUpdate = (gtfs: Gtfs, tripUpdate?: TripUpdate): JourneyCall[] | undefined => {
	if (typeof tripUpdate?.stopTimeUpdate === "undefined") return;
	if (
		tripUpdate.stopTimeUpdate.some(
			({ stopId, arrival, departure }) =>
				!gtfs.stops.has(stopId) || (typeof arrival?.time === "undefined" && typeof departure?.time === "undefined"),
		)
	)
		return;

	const timeZone =
		gtfs.trips.values().next().value?.route.agency.timeZone ??
		new Temporal.TimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

	return tripUpdate.stopTimeUpdate.map((stopTimeUpdate, index) => {
		const stop = gtfs.stops.get(stopTimeUpdate.stopId)!;
		const arrivalTime = Temporal.Instant.fromEpochSeconds(
			(stopTimeUpdate.arrival ?? stopTimeUpdate.departure)!.time!,
		).toZonedDateTimeISO(timeZone);
		const departureTime = Temporal.Instant.fromEpochSeconds(
			(stopTimeUpdate.departure ?? stopTimeUpdate.arrival)!.time!,
		).toZonedDateTimeISO(timeZone);

		return {
			aimedArrivalTime: arrivalTime,
			expectedArrivalTime: arrivalTime,
			aimedDepartureTime: departureTime,
			expectedDepartureTime: departureTime,
			sequence: stopTimeUpdate.stopSequence ?? index,
			stop,
			status: "UNSCHEDULED",
		};
	});
};

const getTripFromDescriptor = (gtfs: Gtfs, tripDescriptor: TripDescriptor) => {
	const trip = gtfs.trips.get(tripDescriptor.tripId);
	if (typeof trip === "undefined") return;

	if (typeof tripDescriptor.routeId !== "undefined" && trip.route.id !== tripDescriptor.routeId) return;
	if (typeof tripDescriptor.directionId !== "undefined" && trip.direction !== tripDescriptor.directionId) return;
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

				const updatedAt = Temporal.Instant.fromEpochSeconds(tripUpdate.timestamp);
				// if (now.since(updatedAt).total("minutes") >= 10) continue;

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

				let journey = source.gtfs.journeys.find((journey) => journey.date.equals(startDate) && journey.trip === trip);
				if (typeof journey === "undefined") {
					journey = trip.getScheduledJourney(startDate, true);
					source.gtfs.journeys.push(journey);
				}
				journey.updateJourney(tripUpdate.stopTimeUpdate ?? []);
			}

			source.gtfs.journeys.sort((a, b) => {
				const aStart = a.calls.at(0)!.expectedArrivalTime ?? a.calls.at(0)!.aimedArrivalTime;
				const bStart = b.calls.at(0)!.expectedArrivalTime ?? b.calls.at(0)!.aimedArrivalTime;
				return aStart.epochSeconds - bStart.epochSeconds;
			});
		}

		for (const vehiclePosition of vehiclePositions) {
			// 👏 https://transport.data.gouv.fr/resources/81925
			if (typeof vehiclePosition.position === "undefined") continue;

			let journey: Journey | undefined;

			const updatedAt = Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp);

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

					journey = source.gtfs.journeys.find((journey) => journey.date.equals(startDate) && journey.trip === trip);
					if (typeof journey === "undefined") {
						journey = trip.getScheduledJourney(startDate, true);
						source.gtfs.journeys.push(journey);
					}

					if (now.since(Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp)).total("minutes") >= 10) {
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
						: typeof vehiclePosition.stopId !== "undefined"
							? journey.calls.slice(journey.calls.findIndex((call) => call.stop.id === vehiclePosition.stopId))
							: getCalls(journey, now, () => Number.POSITIVE_INFINITY)
					: createCallsFromTripUpdate(
							source.gtfs,
							tripUpdates.find((tripUpdate) => tripUpdate.trip.tripId === vehiclePosition.trip?.tripId),
						);

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
					atStop: vehiclePosition.currentStatus === "STOPPED_AT",
					type: "GPS",
					recordedAt: Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp)
						.toZonedDateTimeISO(journey?.trip.route.agency.timeZone ?? "Europe/Paris")
						.toString({ timeZoneName: "never" }),
				},
				journeyRef: typeof journey !== "undefined" ? `${networkRef}:ServiceJourney:${tripRef}` : undefined,
				networkRef,
				operatorRef,
				vehicleRef:
					typeof vehicleRef !== "undefined" ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
				serviceDate: journey?.date.toString(),
				updatedAt: Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp).toString(),
			};

			if (typeof source.options.isValidJourney === "undefined" || source.options.isValidJourney(vehicleJourney)) {
				activeJourneys.set(key, vehicleJourney);
			}
		}

		if (source.options.mode !== "VP-ONLY") {
			for (const journey of source.gtfs.journeys) {
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
							callStatus: call.status,
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
