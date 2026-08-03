import { Map as MaplibreMap, type MapOptions, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
	type ComponentPropsWithoutRef,
	createContext,
	type PropsWithChildren,
	type Ref,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

setWorkerUrl(maplibreWorkerUrl);

type MapComponentProps = PropsWithChildren & {
	containerProps?: ComponentPropsWithoutRef<"div">;
	mapOptions?: Omit<MapOptions, "container">;
	ref?: Ref<MaplibreMap>;
};

const MapContext = createContext<MaplibreMap | null>(null);

// Matched by `isWebGLError()` in the error screen to show the dedicated hardware acceleration message.
const WEBGL_INITIALIZATION_ERROR = "Failed to initialize WebGL: the browser provided no WebGL2 context.";

export function MapComponent({ children, containerProps, mapOptions, ref }: MapComponentProps) {
	const [map, setMap] = useState<MaplibreMap | null>(null);
	const [initializationError, setInitializationError] = useState<Error | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) return;

		const instance = new MaplibreMap({
			...mapOptions,
			container,
		});

		// When no WebGL2 context can be created, maplibre only fires an error event from within the
		// constructor – too early for us to listen to it – and leaves the map without a painter.
		// Such a map renders nothing and cannot even be removed: `remove()` destroys its painter.
		if (instance.painter === undefined) {
			setInitializationError(new Error(WEBGL_INITIALIZATION_ERROR));
			return;
		}

		setMap(instance);

		if (typeof ref === "function") {
			ref(instance);
		} else if (ref !== undefined && ref !== null) {
			ref.current = instance;
		}

		return () => {
			instance.remove();
			setMap(null);
		};
	}, [mapOptions, ref]);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) return;

		let timeout: number | null = null;

		const handleWheel = (e: WheelEvent) => {
			if (timeout !== null) {
				clearTimeout(timeout);
			} else {
				const path = e.composedPath();
				const isInsidePopup = path.some((el) => el instanceof HTMLElement && el.classList.contains("maplibregl-popup"));

				if (!isInsidePopup) {
					container.classList.add("maplibregl-zooming-map");
				}
			}

			timeout = window.setTimeout(() => {
				container.classList.remove("maplibregl-zooming-map");
				timeout = null;
			}, 300);
		};

		container.addEventListener("wheel", handleWheel, { capture: true, passive: true });
		return () => {
			container.removeEventListener("wheel", handleWheel, { capture: true });
			if (timeout !== null) clearTimeout(timeout);
		};
	}, []);

	// thrown during render so the nearest error boundary can display it
	if (initializationError !== null) throw initializationError;

	return (
		<div ref={containerRef} {...containerProps}>
			<MapContext.Provider value={map}>{map !== null && <>{children}</>}</MapContext.Provider>
		</div>
	);
}

export function useMap() {
	const map = useContext(MapContext);
	if (map === null) throw new Error("useMap() must be used within <MapComponent />");
	return map;
}
