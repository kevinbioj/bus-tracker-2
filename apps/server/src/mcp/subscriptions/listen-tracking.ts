type ListenRequest = {
	method?: unknown;
	params?: { notifications?: { resourceSubscriptions?: unknown } };
};

export function readListenedUris(body: unknown): string[] | undefined {
	if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
	const { method, params } = body as ListenRequest;
	if (method !== "subscriptions/listen") return undefined;
	const uris = params?.notifications?.resourceSubscriptions;
	return Array.isArray(uris) ? uris.filter((uri): uri is string => typeof uri === "string") : [];
}

export function trackListenStream(response: Response, signal: AbortSignal, track: () => () => void) {
	const isStream = response.ok && response.headers.get("content-type")?.startsWith("text/event-stream") === true;
	if (!isStream || response.body === null) return response;

	const release = track();
	signal.addEventListener("abort", release, { once: true });
	const reader = response.body.getReader();

	const body = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { value, done } = await reader.read();
				if (done) {
					release();
					controller.close();
				} else {
					controller.enqueue(value);
				}
			} catch (error) {
				release();
				controller.error(error);
			}
		},
		async cancel(reason) {
			release();
			await reader.cancel(reason);
		},
	});

	return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
