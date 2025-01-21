import { Temporal } from "temporal-polyfill";

import type { VehicleJourney, VehicleJourneyCall } from "@bus-tracker/contracts";

import { siriEndpoint } from "../config.js";
import { GET_VEHICLE_MONITORING } from "../payloads/get-vehicle-monitoring.js";
import { siriRequest } from "../utils/siri-request.js";

const fixTimestamp = (input: string) => {
	const plusIndex = input.indexOf("+");
	return `${input}[${input.slice(plusIndex)}]`;
};

const unescapeString = (input: string) => input.replace("&apos;", "'");

export type SiriVehicleActivity = {
	RecordedAtTime: string;
	VehicleMonitoringRef: string;
	MonitoredVehicleJourney: {
		FramedVehicleJourneyRef: {
			DatedVehicleJourneyRef: string;
		};
		LineRef: string;
		PublishedLineName: string;
		VehicleMode: string;
		DirectionName: number;
		DestinationName: string;
		OriginRef: string;
		OriginName: string;
		OriginAimedDepartureTime: string;
		VehicleJourneyName: string;
		VehicleLocation?: {
			Longitude: number;
			Latitude: number;
		};
		MonitoredCall: SiriStopCall;
		OnwardCalls: {
			OnwardCall: SiriStopCall[];
		};
	};
};

export type SiriStopCall = {
	StopPointRef: string;
	Order: number;
	StopPointName: string;
	ArrivalStatus: string;
	AimedArrivalTime: string;
	ExpectedArrivalTime: string;
	DepartureStatus?: string;
	AimedDepartureTime?: string;
	ExpectedDepartureTime?: string;
};

export async function fetchMonitoredVehicles(lineRefs: string[]) {
	const siriResponse = await siriRequest(siriEndpoint, GET_VEHICLE_MONITORING(lineRefs)).catch((e) => console.error(e));

	if (typeof siriResponse === "undefined") {
		return [];
	}

	const vehiclesDelivery =
		siriResponse?.Envelope?.Body?.GetVehicleMonitoringResponse?.Answer?.VehicleMonitoringDelivery;

	const vehicles = (
		typeof vehiclesDelivery?.VehicleActivity === "undefined"
			? []
			: Array.isArray(vehiclesDelivery.VehicleActivity)
				? vehiclesDelivery.VehicleActivity
				: [vehiclesDelivery.VehicleActivity]
	) as SiriVehicleActivity[];

	const processeableVehicles = vehicles
		.toSorted((a, b) =>
			Temporal.ZonedDateTime.compare(
				fixTimestamp(a.MonitoredVehicleJourney.OriginAimedDepartureTime),
				fixTimestamp(b.MonitoredVehicleJourney.OriginAimedDepartureTime),
			),
		)
		.filter(
			(vehicle, index, vehicleList) =>
				typeof vehicle.MonitoredVehicleJourney.VehicleLocation !== "undefined" &&
				vehicleList.findIndex((v) => v.VehicleMonitoringRef === vehicle.VehicleMonitoringRef) === index,
		);

	const vehicleJourneys: VehicleJourney[] = [];

	for (const vehicle of processeableVehicles) {
		const recordedAt = Temporal.ZonedDateTime.from(fixTimestamp(vehicle.RecordedAtTime));
		const [operatorRef, vehicleNumber] = vehicle.VehicleMonitoringRef.split(":")[3]!.split("_");

		const calls = [
			vehicle.MonitoredVehicleJourney.MonitoredCall,
			...(Array.isArray(vehicle.MonitoredVehicleJourney.OnwardCalls.OnwardCall)
				? vehicle.MonitoredVehicleJourney.OnwardCalls.OnwardCall
				: typeof vehicle.MonitoredVehicleJourney.OnwardCalls.OnwardCall !== "undefined"
					? [vehicle.MonitoredVehicleJourney.OnwardCalls.OnwardCall]
					: []),
		].sort((a, b) => a.Order - b.Order);

		const waitingForDeparture =
			Temporal.ZonedDateTime.compare(
				Temporal.Now.zonedDateTimeISO(),
				fixTimestamp(vehicle.MonitoredVehicleJourney.OriginAimedDepartureTime),
			) < 0;

		const nextCalls: VehicleJourneyCall[] = [
			...(waitingForDeparture
				? [
						{
							aimedTime: vehicle.MonitoredVehicleJourney.OriginAimedDepartureTime,
							expectedTime: vehicle.MonitoredVehicleJourney.OriginAimedDepartureTime,
							stopRef: vehicle.MonitoredVehicleJourney.OriginRef.split(":")[3]!,
							stopName: unescapeString(vehicle.MonitoredVehicleJourney.OriginName),
							stopOrder: 1,
							callStatus: "SCHEDULED" as const,
						},
					]
				: []),
			...calls.map((call) => ({
				aimedTime: call.AimedDepartureTime ?? call.AimedArrivalTime,
				expectedTime: call.ExpectedDepartureTime ?? call.ExpectedArrivalTime,
				stopRef: call.StopPointRef.split(":")[3]!,
				stopName: unescapeString(call.StopPointName),
				stopOrder: call.Order,
				callStatus: call.ArrivalStatus === "cancelled" ? ("SKIPPED" as const) : ("SCHEDULED" as const),
			})),
		];

		vehicleJourneys.push({
			id: `TWISTO::VehicleTracking:${vehicleNumber}`,
			line: {
				ref: `TWISTO:Line:${vehicle.MonitoredVehicleJourney.PublishedLineName}`,
				number: vehicle.MonitoredVehicleJourney.PublishedLineName.toString(),
				type: vehicle.MonitoredVehicleJourney.VehicleMode === "tram" ? "TRAMWAY" : "BUS",
			},
			direction: vehicle.MonitoredVehicleJourney.DirectionName === 1 ? "OUTBOUND" : "INBOUND",
			destination: unescapeString(vehicle.MonitoredVehicleJourney.DestinationName),
			calls: nextCalls,
			position: {
				latitude: +vehicle.MonitoredVehicleJourney.VehicleLocation!.Latitude,
				longitude: +vehicle.MonitoredVehicleJourney.VehicleLocation!.Longitude,
				atStop: false,
				type: "GPS",
				recordedAt: recordedAt.toString({ timeZoneName: "never" }),
			},
			journeyRef: vehicle.MonitoredVehicleJourney.VehicleJourneyName,
			networkRef: "TWISTO",
			operatorRef: operatorRef,
			vehicleRef: `TWISTO::Vehicle:${vehicleNumber}`,
			serviceDate: Temporal.Now.plainDateISO().toString(),
			updatedAt: recordedAt.toInstant().toString(),
		});
	}

	return vehicleJourneys;
}
