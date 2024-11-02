export async function getStaleness(href: string) {
	const response = await fetch(href, { method: "HEAD" });
	if (!response.ok) {
		throw new Error(`Unable to get response from '${href}' (status ${response.status}).`);
	}

	return {
		lastModified: response.headers.get("Last-Modified"),
		etag: response.headers.get("ETag"),
	};
}
