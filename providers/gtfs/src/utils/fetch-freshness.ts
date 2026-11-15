import { USER_AGENT } from "../constants.js";
import type { SourceAuth } from "../model/source.js";

import { getAuthHeaders } from "./auth.js";

export type ResourceFreshness = {
	lastModified: string | null;
	etag: string | null;
};

export function readFreshness(headers: Headers): ResourceFreshness {
	return {
		lastModified: headers.get("Last-Modified"),
		etag: headers.get("ETag"),
	};
}

export async function fetchFreshness(href: string, auth?: SourceAuth, method: "HEAD" | "GET" = "HEAD") {
	const response = await fetch(href, {
		headers: {
			"User-Agent": USER_AGENT,
			...getAuthHeaders(auth),
		},
		method,
		signal: AbortSignal.timeout(30_000),
	});
	await response.body?.cancel();

	if (!response.ok) {
		throw new Error(`Unable to get response from '${href}' (status ${response.status}).`);
	}

	return readFreshness(response.headers);
}
