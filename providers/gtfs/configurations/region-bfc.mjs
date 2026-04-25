/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "beaune",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/c00d487c-4766-4ca1-b736-e7de110331d9",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/beaune-cote-et-bus-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
			"https://proxy.transport.data.gouv.fr/resource/beaune-cote-et-bus-gtfs-rt-vehicle-position?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
		getNetworkRef: () => "BEAUNE",
	},
	{
		id: "coeur-de-loire",
		staticResourceHref: "https://pysae.com/api/v2/groups/coeur-de-loire/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/coeur-de-loire/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "COEUR-LOIRE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "dijon",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e0dbd217-15cd-4e28-9459-211a27511a34",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: (trip) =>
			![
				"4-PL",
				"4-39",
				"4-61",
				"4-62",
				"4-63",
				"4-64",
				"4-65",
				"4-66",
				"4-67",
				"4-68",
				"4-69",
				"4-70",
				"4-71",
				"4-72",
				"4-73",
				"4-74",
				"4-75",
			].includes(trip.route),
		getNetworkRef: () => "DIVIA",
		getDestination: (journey) =>
			journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name ?? journey?.trip.headsign,
	},
	{
		id: "dole",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/a8c743ee-e2d4-408c-ac4b-6434b6eaadf9",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/tgd-dole-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/tgd-dole-gtfs-rt-trip-update",
		],
		mode: "NO-TU",
		getNetworkRef: () => "GRANDOLE",
	},
	{
		id: "montbeliard",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/b45aa8d8-4bd4-4528-99c7-acfc980fdb09",
		realtimeResourceHrefs: [],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "EVOLITY",
	},
	{
		id: "vesoul",
		// 2026-04-16 : use n-1 resource as n is broken
		staticResourceHref:
			"https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/81222/81222.20250901.213612.326884.zip",
		// staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/0d6e6c56-8926-49b3-87e2-13c6f57c136b",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/moova-vesoul-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/moova-vesoul-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "MOOVA",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "bfc",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
