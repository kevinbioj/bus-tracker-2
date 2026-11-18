import { resolve } from "node:path";
import { cwd } from "node:process";

import { Source } from "../model/source.js";
import { alignLogScopes, providerLog } from "../utils/logger.js";

import type { Configuration } from "./configuration.js";

export async function loadConfiguration(path: string) {
	const resolvedPath = resolve(cwd(), path);
	try {
		const module = await import(resolvedPath);
		const {
			id,
			computeDelayMs,
			computeConcurrency,
			computeTimeoutMs,
			sources: sourcesOptions,
		} = module.default as Configuration;

		alignLogScopes(sourcesOptions.map(({ id }) => id));
		providerLog.info(`Loaded configuration '${id}' from ${resolvedPath}`);
		const sources = sourcesOptions.map(({ id, ...sourceOptions }) => {
			const source = new Source(id, sourceOptions);
			const feedCount = source.realtimeResources.length;
			source.log.info(`Configured with ${feedCount} real-time feed${feedCount === 1 ? "" : "s"}`);
			return source;
		});
		return { id, computeDelayMs, computeConcurrency, computeTimeoutMs, sources };
	} catch (cause) {
		throw new Error(`Unable to load configuration at '${resolvedPath}'.`, {
			cause,
		});
	}
}
