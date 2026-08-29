import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { posthog } from "posthog-js";
import { useEffect } from "react";

import { hasStyle, isStyleLoaded } from "~/adapters/maplibre-gl/style";

// The style's `background` layer paints without a single network request, so a map still showing
// nothing after this long never got its style JSON: `loadURL()` swallows that failure into an
// `error` event and every hook guarded by `isStyleLoaded()` then waits forever.
const STYLE_LOAD_TIMEOUT = 15_000;

// Delays before each `setStyle()` attempt: a mobile connection drops a request often enough that
// the first retry usually lands, the later ones leave a connection that really went away time to
// come back.
const STYLE_RETRY_DELAYS = [1_000, 5_000, 15_000];

// maplibre fires one error per failed tile: without a cap, a flaky connection floods PostHog.
const MAX_REPORTED_ERRORS = 5;

// A context the browser means to give back comes back in well under a second. Past this delay
// `_contextRestored()` has either never run or bailed out of its own accord, and the map is done
// for: it holds no painter and no style, and nothing will ask for either again.
const CONTEXT_RESTORE_TIMEOUT = 10_000;

// Shaders are compiled lazily on the first draw, so `webglcontextrestored` fires before anything
// is painted: a context can be back and the map still never draw again. Let the restored map try
// for this long before judging whether it actually came back to life.
const CONTEXT_REPAINT_DELAY = 5_000;

// Reported, not thrown: unlike a context that never initializes, this one leaves a mounted map
// behind, and tearing the page down to the error screen would take the whole app with it.
const WEBGL_CONTEXT_LOST_ERROR = "The WebGL context was lost and the browser never restored it.";

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
 * Refetches the style outside of every cache, for when retrying through maplibre keeps hitting a
 * locally corrupted copy: the unique query parameter dodges the workbox precache route (it only
 * ignores `utm_*` and `fbclid`), `cache: "reload"` the HTTP cache. Requires nginx to resolve
 * `try_files` on `$uri`, otherwise the query string turns the response into `index.html`.
 */
async function fetchStyleBypassingCaches(styleUrl: string) {
	const url = new URL(styleUrl, location.href);
	url.searchParams.set("style-recovery", `${Date.now()}`);

	const response = await fetch(url, { cache: "reload" });
	if (!response.ok) throw new Error(`Style recovery failed with HTTP ${response.status}: ${styleUrl}`);

	return (await response.json()) as StyleSpecification;
}

/**
 * Reports what maplibre only ever fires as an `error` event, and reloads a style that never
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
		if (map === null) return;

		const createdAt = Date.now();
		let losses = 0;
		let lostAt: number | null = null;
		let restoreTimeout: number | null = null;
		let repaintTimeout: number | null = null;
		let awaitingVisibility = false;

		/** Everything that describes the drawing surface the browser just took away. */
		const describeContext = () => ({
			map_context_losses: losses,
			map_age_ms: Date.now() - createdAt,
			// the reported symptom is a map dying on zoom, so record what the map was doing
			map_moving: map.isMoving(),
			map_zooming: map.isZooming(),
			map_zoom: Math.round(map.getZoom() * 100) / 100,
			map_pitch: Math.round(map.getPitch()),
			page_visible: document.visibilityState === "visible",
			// a lost context is the browser reclaiming GPU memory: the device tells us how likely
			// that is far better than the failure itself does
			device_pixel_ratio: window.devicePixelRatio,
			device_memory: (navigator as { deviceMemory?: number }).deviceMemory,
			hardware_concurrency: navigator.hardwareConcurrency,
		});

		const onVisibilityChange = () => {
			if (document.visibilityState !== "visible") return;

			awaitingVisibility = false;
			document.removeEventListener("visibilitychange", onVisibilityChange);
			// a page coming back deserves the same grace as one that never left
			restoreTimeout = window.setTimeout(reportUnrestoredContext, CONTEXT_RESTORE_TIMEOUT);
		};

		const reportUnrestoredContext = () => {
			restoreTimeout = null;

			// iOS reclaims the context of a backgrounded page and only hands it back on return:
			// judging a map while it is hidden turns that expected round trip into an error.
			if (document.visibilityState !== "visible") {
				awaitingVisibility = true;
				document.addEventListener("visibilitychange", onVisibilityChange);
				return;
			}

			// `_contextRestored()` returns before firing its event when `_setupPainter()` finds
			// no WebGL2 context left, so a map that dies here does so without a single event.
			posthog.captureException(new Error(WEBGL_CONTEXT_LOST_ERROR), {
				map_style_loaded: isStyleLoaded(map),
				map_style_url: styleUrl,
				...describeContext(),
			});
		};

		const cancelUnrestoredReport = () => {
			if (restoreTimeout !== null) {
				clearTimeout(restoreTimeout);
				restoreTimeout = null;
			}

			if (awaitingVisibility) {
				awaitingVisibility = false;
				document.removeEventListener("visibilitychange", onVisibilityChange);
			}
		};

		const onContextLost = () => {
			losses += 1;
			lostAt = Date.now();

			posthog.capture("map_webgl_context_lost", describeContext());
			restoreTimeout = window.setTimeout(reportUnrestoredContext, CONTEXT_RESTORE_TIMEOUT);
		};

		const onContextRestored = () => {
			cancelUnrestoredReport();

			const lostForMs = lostAt === null ? undefined : Date.now() - lostAt;
			lostAt = null;

			repaintTimeout = window.setTimeout(() => {
				repaintTimeout = null;

				// `loaded()` covers the style maplibre puts back and the tiles it re-requests: a
				// restored context that cannot compile its shaders never gets there.
				posthog.capture("map_webgl_context_restored", {
					map_context_lost_for_ms: lostForMs,
					map_repainted: map.loaded(),
					map_style_loaded: isStyleLoaded(map),
					...describeContext(),
				});
			}, CONTEXT_REPAINT_DELAY);
		};

		map.on("webglcontextlost", onContextLost);
		map.on("webglcontextrestored", onContextRestored);

		return () => {
			map.off("webglcontextlost", onContextLost);
			map.off("webglcontextrestored", onContextRestored);
			cancelUnrestoredReport();
			if (repaintTimeout !== null) clearTimeout(repaintTimeout);
		};
	}, [map, styleUrl]);

	useEffect(() => {
		if (map === null || styleUrl === undefined) return;

		let aborted = false;
		let attempt = 0;
		let bypassedCaches = false;
		let pending: { at: number; timeout: number } | null = null;

		const scheduleAttempt = (delay: number) => {
			if (aborted || isStyleLoaded(map)) return;

			const at = Date.now() + delay;

			// an `error` event lands long before the timeout it was scheduled against expires:
			// bringing the attempt forward recovers the map in a second instead of leaving the
			// user on an empty container for the whole wait.
			if (pending !== null) {
				if (pending.at <= at) return;
				clearTimeout(pending.timeout);
			}

			pending = {
				at,
				timeout: window.setTimeout(() => {
					pending = null;
					void retryStyle();
				}, delay),
			};
		};

		/**
		 * `setStyle()` restarts the whole load, so a style whose JSON never arrived gets another
		 * chance; the hooks waiting on `isStyleLoaded()` pick the new one up through `styledata`.
		 * Every attempt schedules the next one to watch over its own outcome. Retrying goes through
		 * the same caches maplibre used the first time, so once they are exhausted the last resort
		 * is to hand maplibre a style fetched around them.
		 */
		const retryStyle = async () => {
			// a lost context leaves no style behind either, but that one is maplibre's to put back
			if (aborted || isStyleLoaded(map) || !hasStyle(map)) return;

			const nextDelay = STYLE_RETRY_DELAYS[attempt];
			if (nextDelay !== undefined) {
				attempt += 1;
				map.setStyle(styleUrl, { diff: false });
				scheduleAttempt(nextDelay);
				return;
			}

			const environment = await collectEnvironment();
			if (aborted || isStyleLoaded(map)) return;

			try {
				const style = await fetchStyleBypassingCaches(styleUrl);
				if (aborted || isStyleLoaded(map)) return;

				// reported by `onStyleLoad` once maplibre accepts it
				bypassedCaches = true;
				map.setStyle(style);
			} catch (error) {
				posthog.captureException(error, {
					map_style_attempts: attempt,
					map_style_recovery_failed: true,
					map_style_url: styleUrl,
					...environment,
				});
			}
		};

		// a failed style surfaces as an `error` event, the timeout only covers a request that
		// never settles at all.
		const onError = () => scheduleAttempt(STYLE_RETRY_DELAYS[0]);

		const onStyleLoad = () => {
			if (attempt === 0) return;

			const attempts = attempt;
			const bypassed = bypassedCaches;
			attempt = 0;
			bypassedCaches = false;

			void collectEnvironment().then((environment) => {
				posthog.capture("map_style_recovered", {
					map_style_attempts: attempts,
					map_style_bypassed_caches: bypassed,
					map_style_url: styleUrl,
					...environment,
				});
			});
		};

		map.on("error", onError);
		map.on("style.load", onStyleLoad);
		scheduleAttempt(STYLE_LOAD_TIMEOUT);

		return () => {
			aborted = true;
			map.off("error", onError);
			map.off("style.load", onStyleLoad);
			if (pending !== null) clearTimeout(pending.timeout);
		};
	}, [map, styleUrl]);
}
