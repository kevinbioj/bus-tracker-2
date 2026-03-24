import maplibregl from "maplibre-gl";
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

type MapComponentProps = PropsWithChildren & {
	containerProps?: ComponentPropsWithoutRef<"div">;
	mapOptions?: Omit<maplibregl.MapOptions, "container">;
	ref?: Ref<maplibregl.Map>;
};

const MapContext = createContext<maplibregl.Map | null>(null);

export function MapComponent({ children, containerProps, mapOptions, ref }: MapComponentProps) {
	const [map, setMap] = useState<maplibregl.Map | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) return;

		const instance = new maplibregl.Map({
			...mapOptions,
			container,
		});

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
