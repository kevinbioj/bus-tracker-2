import { InfoIcon, LocateIcon } from "lucide-react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useQueryState } from "nuqs";
import { type RefObject, useEffect, useRef, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";
import { fetchShowcaseJourney, type ShowcaseJourney } from "~/api/vehicle-journeys";
import { InstallInstructions } from "~/components/onboarding/install-instructions";
import {
	endMapTour,
	type MapTourTrigger,
	markMapTourSeen,
	markVehiclePopupTourSeen,
	startMapTour,
	startVehiclePopupTour,
	useOnboardingState,
} from "~/components/onboarding/onboarding-state";
import { skippedOutcome, Tour, type TourOutcome, type TourStep } from "~/components/onboarding/tour";
import { buildVehiclePopupSteps } from "~/components/onboarding/vehicle-popup-tour";
import {
	getGeolocateControl,
	getUserPosition,
	triggerGeolocateWhenReady,
} from "~/components/vehicles-map/geolocate-on-start";
import { STOP_ICON_HEIGHT, STOP_ICON_WIDTH } from "~/components/vehicles-map/stops-markers/stop-icon";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { STOP_AREAS_LAYER_ID } from "~/components/vehicles-map/stops-markers/stops-markers-layer";
import { requestVehiclePopupClose } from "~/components/vehicles-map/vehicles-markers/close-vehicle-popup";
import * as m from "~/paraglide/messages";
import { posthog } from "~/utils/posthog";
import { getInstallMethod, type InstallMethod } from "~/utils/pwa-install";

const START_DELAY_MS = 1000;
const MAX_LOAD_WAIT_MS = 4000;
const SHOWCASE_FETCH_TIMEOUT_MS = 3000;
const SHOWCASE_POPUP_TIMEOUT_MS = 10_000;
const SHOWCASE_POLL_INTERVAL_MS = 150;
const SHOWCASE_NETWORK_TIMEOUT_MS = 2500;
const SHOWCASE_SETTLE_MS = 500;
const SHOWCASE_PLACEHOLDER_COUNT = 4;
const STOP_SHOWCASE_ZOOM = 15.5;
const STOP_ZOOM_DURATION_MS = 800;
const STOP_SEARCH_TIMEOUT_MS = 6000;
const STOP_HIGHLIGHT_PADDING = 6;
const DEPARTURES_PANEL_TIMEOUT_MS = 6000;
const DEPARTURES_LOADING_TIMEOUT_MS = 4000;
const DEPARTURES_SETTLE_MS = 700;
const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";
const GEOLOCATE_PERMISSION_TIMEOUT_MS = 30_000;
const GEOLOCATE_CAMERA_TIMEOUT_MS = 15_000;
const GEOLOCATE_STILL_MS = 400;
const CAMERA_POLL_INTERVAL_MS = 50;
const GEOLOCATE_STEP_ID = "geolocate";
const REPLAY_HINT_STEP_ID = "replay-hint";
const DEFERRING_SEARCH_PARAMS = ["line-id", "network-id", "marker-id", "stop-ref", "stop-point", "from_old"];

const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

function pointOf(element: HTMLElement, verticalRatio: number) {
	return {
		contextElement: element,
		getBoundingClientRect: () => {
			const rect = element.getBoundingClientRect();
			return new DOMRect(rect.left + rect.width / 2, rect.top + rect.height * verticalRatio, 0, 0);
		},
	};
}

function withTimeout<T>(promise: Promise<T>, duration: number) {
	return Promise.race([promise, sleep(duration).then(() => undefined)]);
}

async function waitForVehiclePopup(isCancelled: () => boolean) {
	const deadline = Date.now() + SHOWCASE_POPUP_TIMEOUT_MS;
	while (Date.now() < deadline && !isCancelled()) {
		const chips = document.querySelector('.maplibregl-popup [role="dialog"] [data-slot="information-chips"]');
		const root = chips?.closest<HTMLElement>('[role="dialog"]');
		if (root) {
			const networkDeadline = Date.now() + SHOWCASE_NETWORK_TIMEOUT_MS;
			while (root.querySelector('[data-onboarding="network"]') === null && Date.now() < networkDeadline) {
				if (isCancelled()) return null;
				await sleep(SHOWCASE_POLL_INTERVAL_MS);
			}
			await sleep(SHOWCASE_SETTLE_MS);
			return root.isConnected ? root : null;
		}
		await sleep(SHOWCASE_POLL_INTERVAL_MS);
	}
	return null;
}

const geolocateButtonOf = (map: MaplibreMap) =>
	map.getContainer().querySelector<HTMLButtonElement>("button.maplibregl-ctrl-geolocate");

async function canOfferGeolocation(map: MaplibreMap) {
	const button = geolocateButtonOf(map);
	if (!("geolocation" in navigator) || getGeolocateControl(map) === undefined || button === null) return false;
	if (button.matches('[class*="maplibregl-ctrl-geolocate-"]')) return false;

	try {
		const status = await navigator.permissions.query({ name: "geolocation" });
		return status.state !== "denied";
	} catch {
		return true;
	}
}

async function waitForCameraToSettle(map: MaplibreMap) {
	const deadline = Date.now() + GEOLOCATE_CAMERA_TIMEOUT_MS;
	let stillSince = Date.now();
	while (Date.now() < deadline) {
		await sleep(CAMERA_POLL_INTERVAL_MS);
		if (map.isMoving()) stillSince = Date.now();
		else if (Date.now() - stillSince >= GEOLOCATE_STILL_MS) return true;
	}
	return false;
}

async function locateUser(map: MaplibreMap) {
	const control = getGeolocateControl(map);
	if (control === undefined) return false;

	let settleLocated: (located: boolean) => void = () => {};
	const located = new Promise<boolean>((resolve) => {
		settleLocated = resolve;
	});
	const onGeolocate = () => settleLocated(true);
	const onError = () => settleLocated(false);

	control.on("geolocate", onGeolocate);
	control.on("error", onError);
	control.on("outofmaxbounds", onError);
	try {
		if (!(await triggerGeolocateWhenReady(map, control))) return false;
		if ((await withTimeout(located, GEOLOCATE_PERMISSION_TIMEOUT_MS)) !== true) return false;
		if (await waitForCameraToSettle(map)) map.jumpTo({ center: map.getCenter() });
		return true;
	} finally {
		control.off("geolocate", onGeolocate);
		control.off("error", onError);
		control.off("outofmaxbounds", onError);
	}
}

type ShowcaseStop = { ref: string; coordinates: [number, number] };

async function findStopNear(map: MaplibreMap, coordinates: [number, number], isCancelled: () => boolean) {
	const deadline = Date.now() + STOP_SEARCH_TIMEOUT_MS;
	while (Date.now() < deadline && !isCancelled()) {
		if (map.getLayer(STOP_AREAS_LAYER_ID) !== undefined) {
			const origin = map.project(coordinates);
			const { clientWidth: width, clientHeight: height } = map.getContainer();
			const closest = map
				.queryRenderedFeatures({ layers: [STOP_AREAS_LAYER_ID] })
				.map((feature) => {
					const featureCoordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
					return { feature, coordinates: featureCoordinates, point: map.project(featureCoordinates) };
				})
				.filter(
					({ point }) =>
						point.x > width * 0.15 && point.x < width * 0.85 && point.y > height * 0.25 && point.y < height * 0.75,
				)
				.sort((a, b) => a.point.dist(origin) - b.point.dist(origin))
				.at(0);
			if (closest !== undefined) {
				return {
					ref: closest.feature.properties.ref as string,
					coordinates: closest.coordinates,
				} satisfies ShowcaseStop;
			}
		}
		await sleep(SHOWCASE_POLL_INTERVAL_MS);
	}
	return null;
}

async function findStopByRef(map: MaplibreMap, ref: string, isCancelled: () => boolean) {
	const deadline = Date.now() + STOP_SEARCH_TIMEOUT_MS;
	while (Date.now() < deadline && !isCancelled()) {
		if (map.getLayer(STOP_AREAS_LAYER_ID) !== undefined) {
			const feature = map
				.queryRenderedFeatures({ layers: [STOP_AREAS_LAYER_ID] })
				.find((candidate) => candidate.properties.ref === ref);
			if (feature !== undefined) {
				return { ref, coordinates: (feature.geometry as GeoJSON.Point).coordinates as [number, number] };
			}
		}
		await sleep(SHOWCASE_POLL_INTERVAL_MS);
	}
	return null;
}

function stopMarkerTarget(map: MaplibreMap, coordinates: [number, number]) {
	const container = map.getContainer();
	return {
		contextElement: container,
		borderRadius: "10px",
		getBoundingClientRect: () => {
			const bounds = container.getBoundingClientRect();
			const point = map.project(coordinates);
			return new DOMRect(
				bounds.left + point.x - STOP_ICON_WIDTH / 2 - STOP_HIGHLIGHT_PADDING,
				bounds.top + point.y - STOP_ICON_HEIGHT - STOP_HIGHLIGHT_PADDING,
				STOP_ICON_WIDTH + STOP_HIGHLIGHT_PADDING * 2,
				STOP_ICON_HEIGHT + STOP_HIGHLIGHT_PADDING * 2,
			);
		},
	};
}

async function waitForDeparturesPanel(desktop: boolean, isCancelled: () => boolean) {
	const selector = desktop ? ".stop-departures-control" : '[data-slot="drawer-content"]';
	const deadline = Date.now() + DEPARTURES_PANEL_TIMEOUT_MS;
	let panel: HTMLElement | null = null;
	while (panel === null && Date.now() < deadline && !isCancelled()) {
		panel = document.querySelector<HTMLElement>(selector);
		if (panel === null) await sleep(SHOWCASE_POLL_INTERVAL_MS);
	}
	if (panel === null) return null;

	const loadingDeadline = Date.now() + DEPARTURES_LOADING_TIMEOUT_MS;
	while (
		panel.querySelector('.animate-spin, [data-slot="skeleton"]') !== null &&
		Date.now() < loadingDeadline &&
		!isCancelled()
	) {
		await sleep(SHOWCASE_POLL_INTERVAL_MS);
	}
	await sleep(DEPARTURES_SETTLE_MS);
	return panel.isConnected ? panel : null;
}

const placeholders = (mapContainer: HTMLElement, group: string, count: number) =>
	Array.from(
		{ length: count },
		(_, index): TourStep => ({
			id: `${group}-placeholder-${index}`,
			anchor: pointOf(mapContainer, 0.5),
			side: "bottom",
			align: "center",
			title: "",
			body: "",
			group,
		}),
	);

function buildSteps(
	mapContainer: HTMLElement,
	installMethod: InstallMethod | null,
	hasShowcase: boolean,
	canGeolocate: boolean,
	onInstalled: () => void,
) {
	const geolocateButton = document.querySelector(".maplibregl-ctrl-geolocate");
	const filterButton = document.querySelector('[data-slot="map-filter-button"]');
	const settingsButton = document.querySelector('[data-onboarding="settings"]');
	const aboutButton = document.querySelector('[data-onboarding="about"]');
	const announcementsButton = document.querySelector('[data-onboarding="announcements"]');
	const appSettingsButton = document.querySelector('[data-onboarding="app-settings"]');

	const steps: (TourStep | false)[] = [
		{
			id: "welcome",
			anchor: pointOf(mapContainer, 0.25),
			side: "bottom",
			align: "center",
			title: m.onboarding_welcome_title(),
			body: m.onboarding_welcome_body(),
		},
		canGeolocate &&
			geolocateButton !== null && {
				id: GEOLOCATE_STEP_ID,
				anchor: geolocateButton,
				side: "left",
				align: "start",
				title: m.onboarding_geolocate_title(),
				body: m.onboarding_geolocate_body(),
				choice: { accept: m.onboarding_geolocate_accept(), decline: m.onboarding_geolocate_decline() },
			},
		filterButton !== null && {
			id: "filter",
			anchor: filterButton,
			side: "bottom",
			align: "start",
			title: m.onboarding_filter_title(),
			body: m.onboarding_filter_body(),
		},
		settingsButton !== null && {
			id: "settings",
			anchor: settingsButton,
			side: "left",
			align: "start",
			title: m.onboarding_settings_title(),
			body: m.onboarding_settings_body(),
		},
		...(hasShowcase
			? [
					...placeholders(mapContainer, "vehicle", SHOWCASE_PLACEHOLDER_COUNT),
					...placeholders(mapContainer, "stop-marker", 1),
					...placeholders(mapContainer, "stop-departures", 1),
				]
			: []),
		announcementsButton !== null && {
			id: "announcements",
			anchor: announcementsButton,
			side: "bottom",
			align: "end",
			title: m.onboarding_announcements_title(),
			body: m.onboarding_announcements_body(),
		},
		appSettingsButton !== null && {
			id: "app-settings",
			anchor: appSettingsButton,
			side: "bottom",
			align: "end",
			title: m.onboarding_app_settings_title(),
			body: m.onboarding_app_settings_body(),
		},
		installMethod !== null && {
			id: "install",
			anchor: pointOf(mapContainer, 0.85),
			side: "top",
			align: "center",
			title: m.onboarding_install_title(),
			body: m.onboarding_install_body(),
			content: <InstallInstructions method={installMethod} onInstalled={onInstalled} />,
			finalAction: installMethod === "native" ? "later" : "done",
		},
		aboutButton !== null && {
			id: REPLAY_HINT_STEP_ID,
			anchor: aboutButton,
			side: "bottom",
			align: "end",
			title: m.onboarding_replay_title(),
			body: (
				<>
					{m.onboarding_replay_body_before()}
					<InfoIcon aria-label={m.about_aria_label()} className="ml-1 inline size-4 align-text-bottom" />
					{m.onboarding_replay_body_after()}
				</>
			),
		},
	];

	return steps.filter((step) => step !== false);
}

type TourState = { steps: TourStep[]; index: number; busy: boolean };

type MapTourReport = { trigger: MapTourTrigger; reported: boolean };

function reportMapTourOutcome(
	reportRef: RefObject<MapTourReport | undefined>,
	outcome: TourOutcome,
	steps: TourStep[],
	index: number,
) {
	const report = reportRef.current;
	if (report === undefined || report.reported) return;
	report.reported = true;
	posthog.capture("onboarding_finished", {
		tour: "map",
		trigger: report.trigger,
		outcome,
		step: steps[index]?.id,
		step_index: index,
		step_count: steps.filter((step) => step.id !== REPLAY_HINT_STEP_ID).length,
	});
}

type PreparedSteps = { steps: TourStep[]; drop?: string[] };

export function MapTour() {
	const map = useMap();
	const { mapTour } = useOnboardingState();
	const [, setMarkerId] = useQueryState("marker-id");
	const { selectStopArea, clearSelection } = useStopSelection();
	const [tour, setTour] = useState<TourState | null>(null);
	const sessionRef = useRef(0);
	const showcaseRef = useRef<ShowcaseJourney | undefined>(undefined);
	const showcaseStopRef = useRef<ShowcaseStop | null>(null);
	const reportRef = useRef<MapTourReport | undefined>(undefined);
	const tourRef = useRef<TourState | null>(null);

	useEffect(() => {
		tourRef.current = tour;
	});

	useEffect(() => {
		if (mapTour === null) return;

		const searchParams = new URLSearchParams(window.location.search);
		if (mapTour === "first-visit" && DEFERRING_SEARCH_PARAMS.some((param) => searchParams.has(param))) return;

		const session = sessionRef.current;
		let cancelled = false;
		let started = false;
		let loadWaitTimeout: number | undefined;

		const trigger = mapTour;

		const onInstalled = () => {
			sessionRef.current += 1;
			const current = tourRef.current;
			if (current !== null) reportMapTourOutcome(reportRef, "completed", current.steps, current.index);
			setTour(null);
			endMapTour();
		};

		const start = async () => {
			if (started) return;
			started = true;
			map.off("load", start);
			window.clearTimeout(loadWaitTimeout);

			const [showcase, canGeolocate] = await Promise.all([
				withTimeout(fetchShowcaseJourney(), SHOWCASE_FETCH_TIMEOUT_MS),
				canOfferGeolocation(map),
				sleep(START_DELAY_MS),
			]);
			if (cancelled || sessionRef.current !== session) return;

			showcaseRef.current = showcase;
			const installMethod = getInstallMethod();
			const steps = buildSteps(map.getContainer(), installMethod, showcase !== undefined, canGeolocate, onInstalled);
			startMapTour();
			reportRef.current = { trigger, reported: false };
			setTour({ steps, index: 0, busy: false });
			posthog.capture("onboarding_shown", {
				tour: "map",
				trigger,
				steps: steps.map((step) => step.id),
				install_method: installMethod,
				showcase_journey_id: showcase?.id,
			});
		};

		if (map.isStyleLoaded()) {
			void start();
		} else {
			map.once("load", start);
			loadWaitTimeout = window.setTimeout(start, MAX_LOAD_WAIT_MS);
		}

		return () => {
			cancelled = true;
			map.off("load", start);
			window.clearTimeout(loadWaitTimeout);
		};
	}, [map, mapTour]);

	if (tour === null) return null;

	const finish = () => {
		sessionRef.current += 1;
		reportMapTourOutcome(reportRef, "completed", tour.steps, tour.index);
		setTour(null);
		endMapTour();
	};

	const skip = () => {
		if (tour.busy) return;
		markMapTourSeen();
		if (tour.steps[tour.index]?.id === "stop-departures") clearSelection();
		if (tour.steps[tour.index]?.id !== REPLAY_HINT_STEP_ID) {
			reportMapTourOutcome(reportRef, skippedOutcome(tour.index), tour.steps, tour.index);
		}

		const hintIndex = tour.steps.findIndex((step) => step.id === REPLAY_HINT_STEP_ID);
		if (hintIndex > tour.index) setTour({ ...tour, index: hintIndex });
		else finish();
	};

	const isCancelledFor = (session: number) => () => sessionRef.current !== session;

	const prepareVehicle = async (session: number): Promise<PreparedSteps> => {
		const userPosition = getUserPosition(map);
		if (userPosition !== undefined) {
			const nearby = await withTimeout(fetchShowcaseJourney(userPosition), SHOWCASE_FETCH_TIMEOUT_MS);
			if (sessionRef.current !== session) return { steps: [] };
			if (nearby !== undefined) showcaseRef.current = nearby;
		}

		const showcase = showcaseRef.current;
		if (showcase === undefined) return { steps: [] };

		await setMarkerId(showcase.id);
		const root = await waitForVehiclePopup(isCancelledFor(session));
		const steps = root !== null ? buildVehiclePopupSteps(root, true, true) : [];
		if (steps.length > 0) {
			startVehiclePopupTour();
			markVehiclePopupTourSeen();
		}
		posthog.capture("onboarding_showcase", { journey_id: showcase.id, steps: steps.map((step) => step.id) });
		return { steps };
	};

	const prepareStopMarker = async (session: number): Promise<PreparedSteps> => {
		const showcase = showcaseRef.current;
		const nextStop = showcase?.stop;
		requestVehiclePopupClose();

		const center: [number, number] =
			nextStop !== undefined
				? [nextStop.longitude, nextStop.latitude]
				: showcase !== undefined
					? [showcase.position.longitude, showcase.position.latitude]
					: (map.getCenter().toArray() as [number, number]);
		const moved = new Promise<void>((resolve) => map.once("moveend", () => resolve()));
		map.easeTo({ center, zoom: STOP_SHOWCASE_ZOOM, duration: STOP_ZOOM_DURATION_MS });
		await withTimeout(moved, STOP_ZOOM_DURATION_MS + 1000);

		const vehicleStop = nextStop !== undefined ? await findStopByRef(map, nextStop.ref, isCancelledFor(session)) : null;
		const stop = vehicleStop ?? (await findStopNear(map, center, isCancelledFor(session)));
		showcaseStopRef.current = stop;
		posthog.capture("onboarding_showcase_stop", { stop_ref: stop?.ref, next_stop: vehicleStop !== null });
		if (stop === null) return { steps: [], drop: ["stop-departures"] };

		const target = stopMarkerTarget(map, stop.coordinates);
		return {
			steps: [
				{
					id: "stop-marker",
					anchor: target,
					highlight: target,
					side: "bottom",
					align: "center",
					title: m.onboarding_stop_title(),
					body: vehicleStop !== null ? m.onboarding_stop_body_next() : m.onboarding_stop_body(),
				},
			],
		};
	};

	const prepareStopDepartures = async (session: number): Promise<PreparedSteps> => {
		const stop = showcaseStopRef.current;
		if (stop === null) return { steps: [] };

		selectStopArea(stop.ref);
		const desktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
		const panel = await waitForDeparturesPanel(desktop, isCancelledFor(session));
		if (panel === null) return { steps: [] };

		return {
			steps: [
				{
					id: "stop-departures",
					anchor: panel,
					spotlight: panel,
					inertSpotlight: true,
					side: desktop ? "left" : "top",
					align: desktop ? "end" : "center",
					title: m.onboarding_departures_title(),
					body: (
						<>
							{m.onboarding_departures_body_before()}
							<LocateIcon aria-label={m.stop_departures_locate()} className="mx-1 inline size-4 align-text-bottom" />
							{m.onboarding_departures_body_after()}
						</>
					),
				},
			],
		};
	};

	const preparers: Record<string, (session: number) => Promise<PreparedSteps>> = {
		vehicle: prepareVehicle,
		"stop-marker": prepareStopMarker,
		"stop-departures": prepareStopDepartures,
	};

	const next = async ({ declined = false } = {}) => {
		if (tour.busy) return;
		markMapTourSeen();
		if (tour.steps[tour.index]?.id === "stop-departures") clearSelection();

		if (tour.steps[tour.index]?.id === GEOLOCATE_STEP_ID) {
			let located = false;
			if (!declined) {
				const session = sessionRef.current;
				setTour({ ...tour, busy: true });
				located = await locateUser(map);
				if (sessionRef.current !== session) return;
			}
			posthog.capture("onboarding_geolocation", { accepted: !declined, located });
		}

		const nextIndex = tour.index + 1;
		let steps = tour.steps;

		if (steps[nextIndex]?.group !== undefined) {
			const session = sessionRef.current;
			setTour({ ...tour, busy: true });

			let group: string | undefined = steps[nextIndex]?.group;
			while (group !== undefined) {
				const preparing: string = group;
				const { steps: prepared, drop = [] } = await preparers[preparing]!(session);
				if (sessionRef.current !== session) return;

				const dropped = new Set<string>([preparing, ...drop]);
				steps = [
					...steps.slice(0, nextIndex),
					...prepared.map((step) => ({ ...step, transient: true })),
					...steps.slice(nextIndex).filter((step) => step.group === undefined || !dropped.has(step.group)),
				];
				group = prepared.length > 0 ? undefined : steps[nextIndex]?.group;
			}
		}

		if (steps[nextIndex]?.id === REPLAY_HINT_STEP_ID) {
			reportMapTourOutcome(reportRef, "completed", steps, nextIndex - 1);
		}
		if (nextIndex >= steps.length) finish();
		else setTour({ steps, index: nextIndex, busy: false });
	};

	return (
		<Tour
			backdrop={map.getContainer()}
			busy={tour.busy}
			doneLabel={tour.steps.at(-1)?.id === REPLAY_HINT_STEP_ID ? m.onboarding_got_it() : undefined}
			index={tour.index}
			steps={tour.steps}
			onDecline={() => void next({ declined: true })}
			onNext={() => void next()}
			onSkip={skip}
		/>
	);
}
