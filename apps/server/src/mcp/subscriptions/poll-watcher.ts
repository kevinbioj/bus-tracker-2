import { redactError } from "../../server.js";
import { mapWithConcurrency } from "../../utils/map-with-concurrency.js";
import type { ResourceKind } from "../resources/uris.js";
import type { SubscriptionRegistry } from "./registry.js";
import type { ThrottledNotifier } from "./throttled-notifier.js";

export type Fingerprinter = (id: string) => Promise<string | undefined>;

type PollOptions = {
	intervalMs: number;
	concurrency: number;
	maxResourcesPerKind: number;
	fingerprinters: Partial<Record<ResourceKind, Fingerprinter>>;
};

export function watchByPolling(
	registry: SubscriptionRegistry,
	notifier: ThrottledNotifier,
	{ intervalMs, concurrency, maxResourcesPerKind, fingerprinters }: PollOptions,
) {
	const fingerprints = new Map<string, string | undefined>();
	let running = false;

	const pollKind = async (kind: ResourceKind, fingerprint: Fingerprinter, seen: Set<string>) => {
		const ids = registry.idsOf(kind).slice(0, maxResourcesPerKind);
		await mapWithConcurrency(ids, concurrency, async (id) => {
			const key = `${kind}|${id}`;
			seen.add(key);
			const current = await fingerprint(id).catch((error) => {
				console.error("✘ MCP subscription poll failed for %s:", key, redactError(error));
				return fingerprints.get(key);
			});
			const known = fingerprints.has(key);
			const previous = fingerprints.get(key);
			fingerprints.set(key, current);
			if (known && current !== previous) {
				for (const uri of registry.urisOf(kind, id)) notifier.notify(uri);
			}
		});
	};

	const tick = async () => {
		if (running) return;
		running = true;
		try {
			const seen = new Set<string>();
			if (!registry.isEmpty) {
				for (const [kind, fingerprint] of Object.entries(fingerprinters) as [ResourceKind, Fingerprinter][]) {
					await pollKind(kind, fingerprint, seen);
				}
			}
			for (const key of fingerprints.keys()) if (!seen.has(key)) fingerprints.delete(key);
			notifier.prune();
		} finally {
			running = false;
		}
	};

	const timer = setInterval(() => void tick(), intervalMs);
	timer.unref();
	return { tick, stop: () => clearInterval(timer) };
}
