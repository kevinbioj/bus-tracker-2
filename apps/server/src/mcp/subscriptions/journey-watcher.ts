import { journeyStore, onJourneysChanged } from "../../core/store/journey-store.js";
import type { SubscriptionRegistry } from "./registry.js";
import type { ThrottledNotifier } from "./throttled-notifier.js";

export function watchJourneys(registry: SubscriptionRegistry, notifier: ThrottledNotifier) {
	return onJourneysChanged((journeyIds) => {
		if (registry.isEmpty) return;

		const uris = new Set<string>();
		for (const journeyId of journeyIds) {
			for (const uri of registry.urisOf("journey", journeyId)) uris.add(uri);

			const journey = journeyStore.get(journeyId);
			if (journey === undefined) continue;
			for (const uri of registry.urisOf("network", journey.networkId)) uris.add(uri);
			if (journey.lineId !== undefined) {
				for (const uri of registry.urisOf("line", journey.lineId)) uris.add(uri);
			}
			if (journey.vehicle?.id !== undefined) {
				for (const uri of registry.urisOf("vehicle", journey.vehicle.id)) uris.add(uri);
			}
		}
		for (const uri of uris) notifier.notify(uri);
	});
}
