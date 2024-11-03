import { parseArgs } from "node:util";

const { values } = parseArgs({
	options: {
		port: {
			type: "string",
			default: process.env.PORT ?? "8080",
			short: "p",
		},
		"redis-url": {
			type: "string",
			default: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		},
	},
	strict: true,
});

const port = +values.port;

if (Number.isNaN(port) || port < 0 || port > 65535) {
	throw new Error(`Unable to parse '${values.port}' to a port number.`);
}

const redisUrl = values["redis-url"];

export { port, redisUrl };
