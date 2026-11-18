import { parseResourceUri, type ResourceKind } from "../resources/uris.js";

type Subscription = { uri: string; kind: ResourceKind; id: string };

export function createSubscriptionRegistry() {
	const counts = new Map<string, number>();
	const byKey = new Map<string, Map<string, Subscription>>();

	const keyOf = (kind: ResourceKind, id: string) => `${kind}|${id}`;

	const add = (uri: string) => {
		const parsed = parseResourceUri(uri);
		if (parsed === undefined) return false;

		const count = counts.get(uri) ?? 0;
		counts.set(uri, count + 1);
		if (count === 0) {
			const key = keyOf(parsed.kind, parsed.id);
			const subscriptions = byKey.get(key) ?? new Map<string, Subscription>();
			subscriptions.set(uri, { uri, ...parsed });
			byKey.set(key, subscriptions);
		}
		return true;
	};

	const remove = (uri: string) => {
		const count = counts.get(uri);
		if (count === undefined) return;
		if (count > 1) {
			counts.set(uri, count - 1);
			return;
		}

		counts.delete(uri);
		const parsed = parseResourceUri(uri);
		if (parsed === undefined) return;
		const key = keyOf(parsed.kind, parsed.id);
		const subscriptions = byKey.get(key);
		subscriptions?.delete(uri);
		if (subscriptions?.size === 0) byKey.delete(key);
	};

	return {
		track(uris: string[]) {
			const tracked = [...new Set(uris)].filter(add);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				for (const uri of tracked) remove(uri);
			};
		},
		urisOf(kind: ResourceKind, id: string | number) {
			return [...(byKey.get(keyOf(kind, String(id)))?.keys() ?? [])];
		},
		idsOf(kind: ResourceKind) {
			const prefix = `${kind}|`;
			return [...byKey.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
		},
		has(uri: string) {
			return counts.has(uri);
		},
		get isEmpty() {
			return counts.size === 0;
		},
	};
}

export type SubscriptionRegistry = ReturnType<typeof createSubscriptionRegistry>;
