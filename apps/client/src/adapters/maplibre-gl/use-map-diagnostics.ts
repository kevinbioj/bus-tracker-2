import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { posthog } from "posthog-js";
import { useEffect } from "react";

import { isStyleLoaded } from "~/adapters/maplibre-gl/style";

// The style's `background` layer paints without a single network request, so a map still showing
// nothing after this long never got its style JSON: `loadURL()` swallows that failure into an
// `error` event and every hook guarded by `isStyleLoaded()` then waits forever.
const STYLE_LOAD_TIMEOUT = 15_000;

// maplibre fires one error per failed tile: without a cap, a flaky connection floods PostHog.
const MAX_REPORTED_ERRORS = 5;

type MapErrorEvent = { error?: unknown; sourceId?: string };

/** Best-effort context: a broken precache or an exhausted quota is the prime suspect. */
async function collectEnvironment() {
	const environment: Record<string, unknown> = {};

	try {
		environment.sw_controlled = navigator.serviceWorker?.controller != null;
		environment.sw_registrations = (await navigator.serviceWorker?.getRegistrations())?.length;
	} catch {
		// service workers are unavailable in private browsing on some engines
	}

	try {
		const estimate = await navigator.storage?.estimate?.();
		environment.storage_usage = estimate?.usage;
		environment.storage_quota = estimate?.quota;
	} catch {
		// StorageManager is not exposed everywhere
	}

	return environment;
}

/**
 * Refetches the style outside of every cache: the unique query parameter dodges the workbox
 * precache route (it only ignores `utm_*` and `fbclid`), `cache: "reload"` the HTTP cache.
 */
async function fetchStyleBypassingCaches(styleUrl: string) {
	const url = new URL(styleUrl, location.href);
	url.searchParams.set("style-recovery", `${Date.now()}`);

	const response = await fetch(url, { cache: "reload" });
	if (!response.ok) throw new Error(`Style recovery failed with HTTP ${response.status}: ${styleUrl}`);

	return (await response.json()) as StyleSpecification;
}

/**
 * Reports what maplibre only ever fires as an `error` event, and recovers a style that never
 * loaded – both are silent otherwise and leave the user staring at an empty container.
 */
export function useMapDiagnostics(map: MaplibreMap | null, styleUrl?: string) {
	useEffect(() => {
		if (map === null) return;

		let reported = 0;
		const seenMessages = new Set<string>();

		const onError = (event: MapErrorEvent) => {
			const message = String(event.error);
			if (reported >= MAX_REPORTED_ERRORS || seenMessages.has(message)) return;
			seenMessages.add(message);
			reported += 1;

			void collectEnvironment().then((environment) => {
				posthog.captureException(event.error instanceof Error ? event.error : new Error(message), {
					map_error_source_id: event.sourceId,
					map_style_loaded: isStyleLoaded(map),
					map_style_url: styleUrl,
					...environment,
				});
			});
		};

		map.on("error", onError);
		return () => {
			map.off("error", onError);
		};
	}, [map, styleUrl]);

	useEffect(() => {
		if (map === null || styleUrl === undefined) return;

		let aborted = false;

		const recoverStyle = async () => {
			// the timeout always fires: on a healthy map the style is loaded long before.
			if (aborted || isStyleLoaded(map)) return;

			const environment = await collectEnvironment();

			try {
				const style = await fetchStyleBypassingCaches(styleUrl);
				if (aborted || isStyleLoaded(map)) return;

				map.setStyle(style);

				// reachable over the network but not through the app: something between the two –
				// the service worker or one of its caches – is serving a broken response.
				posthog.capture("map_style_recovered", { map_style_url: styleUrl, ...environment });
			} catch (error) {
				posthog.captureException(error, {
					map_style_recovery_failed: true,
					map_style_url: styleUrl,
					...environment,
				});
			}
		};

		const timeout = window.setTimeout(() => void recoverStyle(), STYLE_LOAD_TIMEOUT);

		return () => {
			aborted = true;
			clearTimeout(timeout);
		};
	}, [map, styleUrl]);
}
