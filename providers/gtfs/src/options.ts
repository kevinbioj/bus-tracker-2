import { parseArgs } from "node:util";

// `--redis-url` reste accepté pour ne pas faire échouer les déploiements qui le passent encore : la
// connexion suit `REDIS_URL` (cf. @bus-tracker/redis).
const { positionals } = parseArgs({
	options: { "redis-url": { type: "string" } },
	allowPositionals: true,
	strict: true,
});

if (positionals.length === 0) {
	throw new Error("Please provide the path to a configuration file to import.");
}

export const [configurationPath] = positionals as [string];
