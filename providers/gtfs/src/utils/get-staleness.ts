import { USER_AGENT } from "../constants.js";

export async function getStaleness(href: string) {
	const response = await fetch(href, {
		headers: { "User-Agent": USER_AGENT },
		method: "HEAD",
	});
	if (!response.ok) {
		throw new Error(`Unable to get response from '${href}' (status ${response.status}).`);
	}

	return {
		lastModified: response.headers.get("Last-Modified"),
		etag: response.headers.get("ETag"),
	};
}
