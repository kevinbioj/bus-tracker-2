/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "bordeaux",
		staticResourceHref:
			"https://bdx.mecatran.com/utw/ws/gtfsfeed/static/bordeaux?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt",
		realtimeResourceHrefs: [
			"https://bdx.mecatran.com/utw/ws/gtfsfeed/vehicles/bordeaux?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt",
			"https://bdx.mecatran.com/utw/ws/gtfsfeed/realtime/bordeaux?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TBM",
		getVehicleRef: (vehicle) => {
			if (vehicle?.id.startsWith("ineo")) return vehicle?.id.split(":")[1];
			return !Number.isNaN(+vehicle?.label) ? vehicle?.label : undefined;
		},
		getDestination: (journey) => {
			const lastCall = journey?.calls.at(-1);
			if (typeof lastCall === "undefined" || lastCall.status === "SCHEDULED") return journey?.trip.headsign;
			return journey.calls.findLast((call) => call.status === "SCHEDULED")?.stop.name ?? "HAUT  LE  PIED";
		},
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 30_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
