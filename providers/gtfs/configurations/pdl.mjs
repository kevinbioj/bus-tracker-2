/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "aleop",
		staticResourceHref: "https://donnees.paysdelaloire.fr/data/pdl.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/aleop-pdl-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/aleop-pdl-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" }, // shape distances unavailable
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: (journey) => journey?.trip?.route.agency.id.replace("_", "-") ?? "ALEOP",
		getVehicleRef: (descriptor) => {
			const label = descriptor?.label;

			// We filter out shitness
			if (label === undefined) return;
			if (label.includes("→") || label.includes(">")) return;
			if (/\d/.exec(label) === null) return;

			// Some (same) parc numbers are used by different operators in the same network 🤦
			// so we use licensePlate which should always be here, but still label if not
			if (+label >= 217 && +label <= 226 && +label !== 224) return descriptor.licensePlate ?? descriptor.label;

			// 5 vehicles are identified by their number or by their license plate depending on the Moon's phase
			const normalizedLicensePlate = (
				descriptor.licensePlate === undefined || (+descriptor.licensePlate >= 1 && +descriptor.licensePlate <= 5)
					? descriptor.label
					: descriptor.licensePlate
			).replace(/[- ]/g, "");
			if (
				normalizedLicensePlate !== undefined &&
				["DJ328QV", "DJ359QV", "DJ384QV", "DJ394QV", "EF694KE"].includes(normalizedLicensePlate)
			) {
				return normalizedLicensePlate;
			}

			return label;
		},
		getDestination: (journey) => journey?.trip.headsign?.replace("→", ">"),
	},
	{
		id: "angers",
		staticResourceHref: "https://chouette.enroute.mobi/api/v1/datas/Irigo/gtfs.zip",
		realtimeResourceHrefs: [
			"https://ara-api.enroute.mobi/irigo/gtfs/trip-updates",
			"https://ara-api.enroute.mobi/irigo/gtfs/vehicle-positions",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		gtfsOptions: {
			shapesStrategy: "IGNORE",
			filterTrips: (trip) =>
				[
					"01",
					"02",
					"03",
					"04",
					"05",
					"06",
					"07",
					"08",
					"09",
					"10",
					"11",
					"12",
					"20",
					"21",
					"22",
					"23",
					"24",
					"25",
					"A",
					"B",
					"C",
					"NavM",
					"Tbus",
				].includes(trip.route.id),
		},
		mapVehiclePosition: (vehicle) => {
			if (Number.isNaN(+vehicle.vehicle.id)) {
				return [];
			}
			return vehicle;
		},
		getNetworkRef: () => "IRIGO",
	},
	{
		id: "angers-sub",
		staticResourceHref: "https://pysae.com/api/v2/groups/irigo/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/irigo/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "IRIGO",
		getVehicleRef: (descriptor) => {
			if (Number.isNaN(+descriptor?.label?.trim())) return undefined;
			return +descriptor?.label?.trim();
		},
	},
	{
		id: "cholet",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/choletbus?apiKey=0b0f0b6035007b7f1243311973401c294e6a0143",
		realtimeResourceHrefs: [
			"https://app.mecatran.com/utw/ws/gtfsfeed/realtime/choletbus?apiKey=0b0f0b6035007b7f1243311973401c294e6a0143",
		],
		getNetworkRef: () => "CHOLETBUS",
	},
	{
		id: "guerande",
		staticResourceHref:
			"https://transport.data.gouv.fr/resources/83762/download?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/lila-presquile-cap-atlantique-gtfs-rt?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		mode: "NO-TU",
		getNetworkRef: () => "GUERANDE-ATLANTIQUE",
	},
	{
		id: "laval",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/rd-laval/exports/pan.zip",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "LAVAL",
	},
	{
		id: "roche-sur-yon",
		staticResourceHref: "https://gtfs-rt.infra-hubup.fr/impulsyon/current/revision/gtfs",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/impulsyon/realtime"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) => {
			if (/(?:DM|\d{6})-.+/.test(vehicle.trip?.routeId)) {
				vehicle.trip = undefined;
			}

			return vehicle;
		},
		getNetworkRef: () => "IMPULSYON",
		getVehicleRef: (vehicle) => vehicle?.label,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	{
		id: "saint-nazaire",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/stran-merge?apiKey=2e6071036d276153761f0c090b4a45420e047612&type=gtfs_stran",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "SAINT-NAZAIRE",
	},
	{
		id: "saumur",
		staticResourceHref: "https://mobi-iti-pdl.okina.fr/static/mobiiti_saumur_val_de_loire/gtfs_imported-id_saumur.zip",
		realtimeResourceHrefs: [],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "OGALO",
		getDestination: (journey) => journey?.calls.at(-1)?.stop.name,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 15_000,
	sources,
};

export default configuration;
