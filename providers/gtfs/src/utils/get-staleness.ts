import { USER_AGENT } from "../constants.js";
import type { SourceAuth } from "../model/source.js";

import { getAuthHeaders } from "./auth.js";

export async function getStaleness(href: string, auth?: SourceAuth) {
	const response = await fetch(href, {
		headers: {
			"User-Agent": USER_AGENT,
			...getAuthHeaders(auth),
		},
		method: "HEAD",
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok) {
		throw new Error(`Unable to get response from '${href}' (status ${response.status}).`);
	}

	return {
		lastModified: response.headers.get("Last-Modified"),
		etag: response.headers.get("ETag"),
	};
}
