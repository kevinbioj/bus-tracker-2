export type ThrottledNotifier = {
	notify: (uri: string) => void;
	prune: () => void;
	dispose: () => void;
};

export function createThrottledNotifier(
	publish: (uri: string) => void,
	isSubscribed: (uri: string) => boolean,
	intervalMs: number,
): ThrottledNotifier {
	const lastSentAt = new Map<string, number>();
	const pending = new Map<string, ReturnType<typeof setTimeout>>();

	const send = (uri: string) => {
		pending.delete(uri);
		if (!isSubscribed(uri)) {
			lastSentAt.delete(uri);
			return;
		}
		lastSentAt.set(uri, Date.now());
		publish(uri);
	};

	return {
		notify(uri) {
			if (pending.has(uri)) return;
			const elapsedMs = Date.now() - (lastSentAt.get(uri) ?? Number.NEGATIVE_INFINITY);
			if (elapsedMs >= intervalMs) {
				send(uri);
				return;
			}
			const timer = setTimeout(() => send(uri), intervalMs - elapsedMs);
			timer.unref();
			pending.set(uri, timer);
		},
		prune() {
			for (const uri of lastSentAt.keys()) {
				if (!pending.has(uri) && !isSubscribed(uri)) lastSentAt.delete(uri);
			}
		},
		dispose() {
			for (const timer of pending.values()) clearTimeout(timer);
			pending.clear();
			lastSentAt.clear();
		},
	};
}
