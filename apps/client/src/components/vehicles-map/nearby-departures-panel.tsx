import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { InfoIcon, MapPinnedIcon, XIcon } from "lucide-react";
import type { MapLibreEvent, Map as MaplibreMap } from "maplibre-gl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { isRealtimeAvailable, sendRealtimeMessage, subscribeRealtimeMessages, useRealtimeStatus } from "~/api/realtime";
import { GetNearbyDeparturesQuery, type NearbyPosition } from "~/api/stops";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { type DepartureListRow, DeparturesList, formatDepartureLabel } from "~/components/vehicles-map/departure-row";
import {
	onUserLocationTrackingStart,
	useUserGeolocation,
	watchUserPosition,
} from "~/components/vehicles-map/geolocate-on-start";
import { registerMapBottomOverlay } from "~/components/vehicles-map/map-bottom-overlay";
import { useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import * as m from "~/paraglide/messages";
import { getLocale } from "~/paraglide/runtime";

const RESUBSCRIBE_DISTANCE_M = 50;
const LABELS_REFRESH_INTERVAL_MS = 5_000;
const EARTH_RADIUS_M = 6_371_000;

function distanceMeters(from: NearbyPosition, to: NearbyPosition) {
	const toRadians = Math.PI / 180;
	const dLat = (to.latitude - from.latitude) * toRadians;
	const dLon = (to.longitude - from.longitude) * toRadians;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(from.latitude * toRadians) * Math.cos(to.latitude * toRadians) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function formatDistance(meters: number) {
	const kilometers = meters >= 1_000;
	return new Intl.NumberFormat(getLocale(), {
		style: "unit",
		unit: kilometers ? "kilometer" : "meter",
		maximumFractionDigits: kilometers ? 1 : 0,
	}).format(kilometers ? meters / 1_000 : Math.round(meters / 10) * 10);
}

function crosshairPointOf(map: MaplibreMap, bottomInset: number): NearbyPosition {
	const { clientWidth, clientHeight } = map.getContainer();
	const { lng, lat } = map.unproject([clientWidth / 2, (clientHeight - bottomInset) / 2]);
	return { latitude: lat, longitude: lng };
}

function useCrosshairPoint(map: MaplibreMap, bottomInset: number) {
	const [crosshairPoint, setCrosshairPoint] = useState<NearbyPosition | null>(null);
	const [movedByUser, setMovedByUser] = useState(false);

	useEffect(() => {
		let gesture = false;
		const update = () => {
			setCrosshairPoint(crosshairPointOf(map, bottomInset));
			if (gesture) setMovedByUser(true);
			gesture = false;
		};
		const onMoveStart = (event: MapLibreEvent<unknown>) => {
			if (event.originalEvent !== undefined) gesture = true;
		};

		update();
		map.on("moveend", update);
		map.on("movestart", onMoveStart);
		return () => {
			map.off("moveend", update);
			map.off("movestart", onMoveStart);
		};
	}, [map, bottomInset]);

	useEffect(() => onUserLocationTrackingStart(map, () => setMovedByUser(false)), [map]);

	return { crosshairPoint, movedByUser };
}

function useNearbyDepartures(bottomInset: number) {
	const map = useMap();
	const geolocation = useUserGeolocation(map);
	const [displayMode] = useNextCallsDisplayMode();
	const { crosshairPoint, movedByUser } = useCrosshairPoint(map, bottomInset);

	useEffect(() => watchUserPosition(map), [map]);

	const userPosition = geolocation.position;
	const geolocationFailed =
		userPosition === undefined && (geolocation.status === "denied" || geolocation.status === "unavailable");
	const aroundCrosshair = movedByUser || geolocationFailed;
	const searchPoint = aroundCrosshair ? crosshairPoint : (userPosition ?? null);

	const [watchedPosition, setWatchedPosition] = useState<NearbyPosition | null>(null);
	if (
		searchPoint !== null &&
		(watchedPosition === null || distanceMeters(watchedPosition, searchPoint) > RESUBSCRIBE_DISTANCE_M)
	) {
		setWatchedPosition(searchPoint);
	}

	const realtimeStatus = useRealtimeStatus();
	const realtime = isRealtimeAvailable(realtimeStatus);
	const connected = realtimeStatus === "open";

	const queryClient = useQueryClient();
	useEffect(
		() =>
			subscribeRealtimeMessages((message) => {
				if (message.nearbyDepartures === undefined) return;
				const { latitude, longitude } = message.nearbyDepartures;
				const query = GetNearbyDeparturesQuery({ latitude, longitude });
				if ("unavailable" in message.nearbyDepartures) {
					void queryClient.fetchQuery({ ...query, staleTime: 0 }).catch(() => undefined);
				} else {
					queryClient.setQueryData(query.queryKey, message.nearbyDepartures.departures);
				}
			}),
		[queryClient],
	);

	useEffect(() => {
		if (!connected || watchedPosition === null) return;
		sendRealtimeMessage({ type: "watch-nearby", position: watchedPosition });
		return () => {
			sendRealtimeMessage({ type: "watch-nearby", position: null });
		};
	}, [connected, watchedPosition]);

	const { data, isError, isPending } = useQuery(GetNearbyDeparturesQuery(watchedPosition, realtime));
	const departures = data?.departures ?? [];

	const networkIds = [
		...new Set(departures.flatMap(({ lineNetworkId }) => (lineNetworkId !== undefined ? [lineNetworkId] : []))),
	].toSorted((a, b) => a - b);
	const { linesById, isPending: areLinesPending } = useQueries({
		queries: networkIds.map((networkId) => GetNetworkQuery(networkId, true)),
		combine: (networks) => ({
			linesById: new Map(
				networks.flatMap(({ data: network }) => network?.lines.map((line) => [line.id, line] as const) ?? []),
			),
			isPending: networks.some(({ isPending }) => isPending),
		}),
	});

	const [now, setNow] = useState(() => dayjs());
	useEffect(() => {
		const interval = setInterval(() => setNow(dayjs()), LABELS_REFRESH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, []);

	const keyOccurrences = new Map<string, number>();
	const rows: DepartureListRow[] = departures.flatMap((departure) => {
		const line = departure.lineId !== undefined ? linesById.get(departure.lineId) : undefined;
		if (line === undefined) return [];

		const baseKey = `${departure.journeyId ?? departure.lineId}-${departure.aimedTime}-${departure.stopRef}`;
		const occurrence = keyOccurrences.get(baseKey) ?? 0;
		keyOccurrences.set(baseKey, occurrence + 1);

		return [
			{
				departure,
				line,
				label: formatDepartureLabel(departure, displayMode, now),
				key: `${baseKey}-${occurrence}`,
				stopLabel: m.nearby_departures_stop({
					stop: departure.stopAreaName,
					distance: formatDistance(departure.distance),
				}),
			},
		];
	});

	const lastCompleteRowsRef = useRef<DepartureListRow[]>([]);
	if (!areLinesPending) lastCompleteRowsRef.current = rows;
	const displayedRows = areLinesPending && lastCompleteRowsRef.current.length > 0 ? lastCompleteRowsRef.current : rows;

	return {
		aroundCrosshair,
		located: watchedPosition !== null,
		rows: displayedRows,
		isError: isError && displayedRows.length === 0,
		isLoading: displayedRows.length === 0 && (isPending || areLinesPending),
	};
}

type NearbyDeparturesState = ReturnType<typeof useNearbyDepartures>;

function MapCrosshair({ bottomInset }: Readonly<{ bottomInset: number }>) {
	const map = useMap();
	const [container, setContainer] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		const element = document.createElement("div");
		element.className = "pointer-events-none absolute inset-0 z-1";
		map.getContainer().append(element);
		setContainer(element);
		return () => element.remove();
	}, [map]);

	return (
		container !== null &&
		createPortal(
			<div
				aria-hidden="true"
				className="absolute left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-500/80 dark:bg-neutral-300/80"
				style={{ top: `calc((100% - ${bottomInset}px) / 2)` }}
			/>,
			container,
		)
	);
}

function NearbyDeparturesHeader({ touch = false, close }: Readonly<{ touch?: boolean; close: ReactNode }>) {
	const title = m.nearby_departures_title();

	return (
		<div className="flex items-center gap-1 border-b py-1.5 pr-1.5 pl-3">
			<div className="mr-1 min-w-0 flex-1">
				{touch ? (
					<DrawerTitle className="flex min-w-0 items-center gap-1.5 text-lg">
						<MapPinnedIcon className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate font-bold leading-tight">{title}</span>
					</DrawerTitle>
				) : (
					<p className="flex min-w-0 items-center gap-1.5">
						<MapPinnedIcon className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate text-base font-bold leading-tight">{title}</span>
					</p>
				)}
			</div>
			{close}
		</div>
	);
}

function NearbyDeparturesBody({
	state: { located, rows, isError, isLoading },
	touch,
	scrollClassName,
}: Readonly<{
	state: NearbyDeparturesState;
	touch?: boolean;
	scrollClassName: string;
}>) {
	if (!located) {
		return (
			<p className="m-auto flex items-center gap-2 px-3 py-3 text-center text-sm text-muted-foreground">
				<InfoIcon className="size-4 shrink-0" />
				{m.nearby_departures_locating()}
			</p>
		);
	}

	return (
		<DeparturesList
			direction="departures"
			isError={isError}
			isLoading={isLoading}
			messages={{
				error: m.nearby_departures_error(),
				loading: m.nearby_departures_loading(),
				empty: m.nearby_departures_empty(),
			}}
			rows={rows}
			scrollClassName={scrollClassName}
			touch={touch}
		/>
	);
}

function NearbyDeparturesControl() {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const { closeNearby } = useStopSelection();
	const state = useNearbyDepartures(0);

	useEffect(() => {
		const container = containerRef.current;
		container.className = "maplibregl-ctrl maplibregl-ctrl-group font-sans stop-departures-control";

		const control = {
			onAdd: () => container,
			onRemove: () => container.remove(),
		};

		map.addControl(control, "bottom-right");
		const parent = container.parentElement;
		if (parent) {
			parent.style.zIndex = "10";
			const attribution = parent.querySelector(":scope > .maplibregl-ctrl-attrib");
			parent.insertBefore(container, attribution);
		}
		return () => {
			map.removeControl(control);
		};
	}, [map]);

	return (
		<>
			{state.aroundCrosshair && <MapCrosshair bottomInset={0} />}
			{createPortal(
				<div className="w-96 max-w-[calc(100dvw-20px)] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
					<NearbyDeparturesHeader
						close={
							<Button
								className="size-7 shrink-0"
								size="icon"
								title={m.stop_departures_close()}
								type="button"
								variant="ghost"
								onClick={closeNearby}
							>
								<XIcon className="size-4 m-auto" />
							</Button>
						}
					/>
					<div className="flex min-h-[min(10rem,25dvh)] flex-col">
						<NearbyDeparturesBody scrollClassName="max-h-[35dvh]" state={state} />
					</div>
				</div>,
				containerRef.current,
			)}
		</>
	);
}

function hiddenHeightOf(map: MaplibreMap, element: HTMLElement) {
	const mapRect = map.getContainer().getBoundingClientRect();
	const top = window.innerHeight - element.offsetHeight;
	return Math.round(Math.min(mapRect.height, Math.max(0, mapRect.bottom - top)));
}

function NearbyDeparturesDrawer() {
	const map = useMap();
	const [open, setOpen] = useState(true);
	const [bottomInset, setBottomInset] = useState(0);
	const { closeNearby } = useStopSelection();
	const state = useNearbyDepartures(bottomInset);

	return (
		<>
			{state.aroundCrosshair && <MapCrosshair bottomInset={bottomInset} />}
			<Drawer
				disablePointerDismissal
				modal={false}
				open={open}
				onOpenChange={setOpen}
				onOpenChangeComplete={(open) => {
					if (!open) closeNearby();
				}}
			>
				<DrawerContent
					className="h-[45dvh]"
					ref={(element) => {
						if (element === null) return;
						const unregister = registerMapBottomOverlay(element);
						const observer = new ResizeObserver(() => setBottomInset(hiddenHeightOf(map, element)));
						observer.observe(element);
						return () => {
							observer.disconnect();
							unregister?.();
						};
					}}
					showOverlay={false}
				>
					<NearbyDeparturesHeader
						close={
							<DrawerClose
								render={
									<Button className="size-9 shrink-0" size="icon" title={m.stop_departures_close()} variant="ghost">
										<XIcon className="size-5 m-auto" />
									</Button>
								}
							/>
						}
						touch
					/>
					<div className="flex min-h-[min(10rem,25dvh)] flex-1 flex-col">
						<NearbyDeparturesBody
							scrollClassName="min-h-0 flex-1 pb-6 mask-b-from-[calc(100%-1.5rem)]"
							state={state}
							touch
						/>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}

export function NearbyDeparturesPanel() {
	const isDesktop = useMediaQuery("(min-width: 640px)");
	if (isDesktop) return <NearbyDeparturesControl />;
	return createPortal(<NearbyDeparturesDrawer />, document.body);
}
