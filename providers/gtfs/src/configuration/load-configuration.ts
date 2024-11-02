import { resolve } from "node:path";
import { cwd } from "node:process";

import type { Configuration } from "./configuration.js";

export async function loadConfiguration(path: string) {
	const resolvedPath = resolve(cwd(), path);
	try {
		console.log("► Loading configuration '%s'.", resolvedPath);
		const module = await import(resolvedPath);
		const configuration = module.default as Configuration;
		for (const source of configuration.sources) {
			console.log(
				`\tⓘ Loaded source '%s' with %d real-time feed(s).`,
				source.id,
				source.realtimeResourceHrefs?.length ?? 0,
			);
		}
		console.log();
		return configuration;
	} catch (cause) {
		throw new Error(`Unable to load configuration at '${resolvedPath}'.`, { cause });
	}
}
