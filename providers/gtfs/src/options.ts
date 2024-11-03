import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
	options: {
		"redis-url": {
			type: "string",
			default: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		},
	},
	allowPositionals: true,
	strict: true,
});

if (positionals.length === 0) {
	throw new Error("Please provide the path to a configuration file to import.");
}

const [configurationPath] = positionals as [string];
const redisUrl = values["redis-url"];

export { configurationPath, redisUrl };
