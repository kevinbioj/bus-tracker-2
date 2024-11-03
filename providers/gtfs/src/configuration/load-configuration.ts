import { resolve } from "node:path";
import { cwd } from "node:process";

import { Source } from "../model/source.js";
import type { Configuration } from "./configuration.js";

export async function loadConfiguration(path: string) {
	const resolvedPath = resolve(cwd(), path);
	try {
		console.log("► Loading configuration '%s'.", resolvedPath);
		const module = await import(resolvedPath);
		const { computeDelayMs, redisOptions, sources: sourcesOptions } = module.default as Configuration;

		const sources = sourcesOptions.map(({ id, ...sourceOptions }) => {
			const source = new Source(id, sourceOptions);
			console.log(
				`\tⓘ Loaded source '%s' with %d real-time feed(s).`,
				id,
				sourceOptions.realtimeResourceHrefs?.length ?? 0,
			);
			return source;
		});

		console.log();
		return { computeDelayMs, redisOptions, sources };
	} catch (cause) {
		throw new Error(`Unable to load configuration at '${resolvedPath}'.`, { cause });
	}
}
