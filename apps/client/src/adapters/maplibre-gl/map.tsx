import maplibregl from "maplibre-gl";
import {
	type ComponentPropsWithoutRef,
	createContext,
	type PropsWithChildren,
	type Ref,
	useCallback,
	useContext,
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

	const containerRef = useCallback(
		(container: HTMLDivElement | null) => {
			if (container === null) return;

			const instance = new maplibregl.Map({
				...mapOptions,
				container,
			});

			setMap(instance);

			if (typeof ref === "function") {
				ref(instance);
			} else if (typeof ref !== "undefined" && ref !== null) {
				ref.current = instance;
			}

			return () => {
				instance.remove();
				setMap(null);
			};
		},
		[mapOptions, ref],
	);

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
