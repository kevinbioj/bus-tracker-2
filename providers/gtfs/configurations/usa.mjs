/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "nashville",
		staticResourceHref: "https://www.wegotransit.com/GoogleExport/Google_Transit.zip",
		realtimeResourceHrefs: [
			"http://transitdata.nashvillemta.org/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb",
			"http://transitdata.nashvillemta.org/TMGTFSRealTimeWebService/tripupdate/tripupdates.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "USA-NASHVILLE",
		getVehicleRef: (vehicle) => vehicle?.label,
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
