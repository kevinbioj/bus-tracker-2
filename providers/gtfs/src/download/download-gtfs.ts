import { Buffer } from "node:buffer";
import decompress from "decompress";

import { USER_AGENT } from "../constants.js";
import type { Source } from "../model/source.js";
import { getAuthHeaders } from "../utils/auth.js";

export async function downloadGtfs(source: Source, outputDirectory: string) {
	const response = await fetch(source.options.staticResourceHref, {
		headers: {
			"User-Agent": USER_AGENT,
			...getAuthHeaders(source.options.staticAuth ?? source.options.auth),
		},
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok) {
		throw new Error(`Download from '${source.options.staticResourceHref}' failed (${response.status}).`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	try {
		await decompress(buffer, outputDirectory);
	} catch (cause) {
		throw new Error(`Failed to extract resource into '${outputDirectory}'.`, {
			cause,
		});
	}
}
