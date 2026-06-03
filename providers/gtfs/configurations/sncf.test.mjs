import { describe, expect, it } from "vitest";

import configuration, {
	createSiriLiteJourneyMap,
	enrichSncfJourneyWithSiriLitePlatforms,
	GTFS_RT_TRIP_UPDATES_URL,
	getSiriLiteEstimatedVehicleJourneys,
	getSiriLiteTrainNumbers,
	normalizeSncfStopRef,
	SIRI_LITE_ESTIMATED_TIMETABLE_URL,
} from "./sncf.mjs";

const siriLitePayload = {
	Siri: {
		ServiceDelivery: {
			EstimatedTimetableDelivery: {
				EstimatedJourneyVersionFrame: {
					EstimatedVehicleJourney: [
						{
							OriginRef: "87721159",
							DestinationRef: "87721431",
							TrainNumbers: {
								TrainNumberRef: "890004",
							},
							RecordedCalls: {
								RecordedCall: [
									{
										StopPointRef: "FR:ScheduledStopPoint::87721159",
										Order: 1,
										DeparturePlatformName: "D",
									},
									{
										StopPointRef: "FR:ScheduledStopPoint::87721175",
										Order: 2,
										ArrivalPlatformName: "A",
										DeparturePlatformName: "A",
									},
								],
							},
							EstimatedCalls: {
								EstimatedCall: {
									StopPointRef: "FR:ScheduledStopPoint::87721431",
									Order: 3,
									ArrivalPlatformName: "B",
								},
							},
						},
					],
				},
			},
		},
	},
};

describe("SNCF SIRI Lite helpers", () => {
	it("keeps the GTFS-RT feed separate from the SIRI Lite platform feed", () => {
		expect(configuration.sources[0].realtimeResourceHrefs).toEqual([GTFS_RT_TRIP_UPDATES_URL]);
		expect(SIRI_LITE_ESTIMATED_TIMETABLE_URL).toBe(
			"https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable",
		);
	});

	it("normalizes SNCF and SIRI Lite stop refs", () => {
		expect(normalizeSncfStopRef("FR:ScheduledStopPoint::87721159")).toBe("87721159");
		expect(normalizeSncfStopRef("SNCF:StopPoint:87721159")).toBe("87721159");
	});

	it("extracts estimated vehicle journeys and indexes them by train number", () => {
		const journeys = getSiriLiteEstimatedVehicleJourneys(siriLitePayload);
		const journeyMap = createSiriLiteJourneyMap(siriLitePayload);

		expect(journeys).toHaveLength(1);
		expect(getSiriLiteTrainNumbers(journeys[0])).toEqual(["890004"]);
		expect(journeyMap.get("890004")).toBe(journeys[0]);
	});

	it("applies ArrivalPlatformName to matching calls only", () => {
		const [siriLiteJourney] = getSiriLiteEstimatedVehicleJourneys(siriLitePayload);
		const vehicleJourney = {
			calls: [
				{
					stopRef: "SNCF:StopPoint:87721159",
					stopName: "Lyon Saint-Paul",
					platformName: "scheduled-origin",
				},
				{
					stopRef: "SNCF:StopPoint:87721175",
					stopName: "Lyon Gorge de Loup",
					platformName: "scheduled-middle",
				},
				{
					stopRef: "SNCF:StopPoint:87721431",
					stopName: "L'Arbresle",
					platformName: "scheduled-destination",
				},
			],
		};

		enrichSncfJourneyWithSiriLitePlatforms(vehicleJourney, siriLiteJourney);

		expect(vehicleJourney.calls.map((call) => call.platformName)).toEqual(["scheduled-origin", "A", "B"]);
	});

	it("keeps enriching matching stops even when origin and destination differ", () => {
		const siriLiteJourney = {
			OriginRef: "other-origin",
			DestinationRef: "other-destination",
			TrainNumbers: {
				TrainNumberRef: "890004",
			},
			EstimatedCalls: {
				EstimatedCall: {
					StopPointRef: "FR:ScheduledStopPoint::87721175",
					Order: 1,
					ArrivalPlatformName: "A",
				},
			},
		};
		const vehicleJourney = {
			calls: [
				{
					stopRef: "SNCF:StopPoint:87721175",
					stopName: "Lyon Gorge de Loup",
					platformName: "scheduled",
				},
			],
		};

		enrichSncfJourneyWithSiriLitePlatforms(vehicleJourney, siriLiteJourney);

		expect(vehicleJourney.calls[0].platformName).toBe("A");
	});
});
