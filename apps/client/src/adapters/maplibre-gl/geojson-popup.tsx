import maplibregl from "maplibre-gl";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CircleMarkerFeature, CircleMarkerSource } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { cn } from "~/utils/utils";

type ActiveFeature = {
	id: string;
	type: "hover" | "selected";
};

type MapCircleMarkersPopup = {
	children: (props: {
		activeFeature: ActiveFeature | null;
		openPopup: (feature: CircleMarkerFeature, type: "hover" | "selected") => void;
	}) => ReactNode;
	layer: maplibregl.StyleLayer;
	popupOptions?: maplibregl.PopupOptions;
};

export function GeojsonPopup({ children, layer, popupOptions }: MapCircleMarkersPopup) {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const isMapDragged = useRef(false);

	const [popup] = useState(
		() =>
			new maplibregl.Popup({
				...popupOptions,
				className: cn(popupOptions?.className, "transition-opacity duration-250 opacity-0 data-open:opacity-100"),
			}),
	);
	const [activeFeature, setActiveFeature] = useState<ActiveFeature | null>(null);
	const activeFeatureRef = useRef<CircleMarkerFeature>(null);

	const adjustPan = useCallback(() => {
		// do not force if user is dragging the map
		if (isMapDragged.current) return;

		const mapCanvas = map.getCanvas();
		const mapRect = mapCanvas.getBoundingClientRect();
		const popupEl = popup.getElement();
		const popupRect = popupEl.getBoundingClientRect();

		const margin = 5;
		const overflowTop = Math.max(0, mapRect.top + margin - popupRect.top);
		const overflowBottom = Math.max(0, popupRect.bottom - (mapRect.bottom - margin));
		const overflowLeft = Math.max(0, mapRect.left + margin - popupRect.left);
		const overflowRight = Math.max(0, popupRect.right - (mapRect.right - margin));

		let dx = 0;
		let dy = 0;
		if (overflowLeft > 0) dx = -overflowLeft;
		if (overflowRight > 0) dx = overflowRight;
		if (overflowTop > 0) dy = -overflowTop;
		if (overflowBottom > 0) dy = overflowBottom;

		if (dx !== 0 || dy !== 0) {
			map.panBy([dx, dy], {
				duration: 100,
				easing: (t) => t * (2 - t),
			});
		}
	}, [map, popup]);

	const openPopup = useCallback(
		(feature: CircleMarkerFeature) => {
			activeFeatureRef.current = feature;
			popup.setLngLat(feature.geometry.coordinates);
			if (typeof popup._map === "undefined") {
				popup.setDOMContent(containerRef.current).addTo(map);
				setTimeout(() => {
					popup.getElement().setAttribute("data-open", "true");
				});
			}
		},
		[map, popup],
	);

	const closePopup = useCallback(() => {
		popup.getElement()?.removeAttribute("data-open");
		popup.remove();
		activeFeatureRef.current = null;
		setActiveFeature(null);
	}, [popup]);

	useEffect(() => {
		const onOpen = () => {
			if (activeFeature?.type === "selected") adjustPan();
		};

		popup.on("open", onOpen);
		return () => void popup.off("open", onOpen);
	}, [activeFeature, adjustPan, popup]);

	useEffect(() => {
		const onDragStart = () => {
			isMapDragged.current = true;
		};

		const onDragEnd = () => {
			isMapDragged.current = false;
		};

		map.on("dragstart", onDragStart);
		map.on("dragend", onDragEnd);
		return () => {
			map.off("dragstart", onDragStart);
			map.off("dragend", onDragEnd);
		};
	});

	useEffect(() => {
		const onMouseEnter = () => {
			map.getCanvas().style.cursor = "pointer";
		};

		const onMouseLeave = () => {
			map.getCanvas().style.cursor = "";
		};

		map.on("mouseenter", layer.id, onMouseEnter);
		map.on("mouseleave", layer.id, onMouseLeave);
		return () => {
			map.off("mouseenter", layer.id, onMouseEnter);
			map.off("mouseleave", layer.id, onMouseLeave);
		};
	}, [layer, map]);

	useEffect(() => {
		const onMouseMove = (e: maplibregl.MapMouseEvent) => {
			const features = map.queryRenderedFeatures(e.point, {
				layers: [layer.id],
			});

			const feature = features[0] as unknown as CircleMarkerFeature;
			if (typeof feature === "undefined") {
				if (activeFeature?.type === "hover") {
					closePopup();
				}
				return;
			}

			if (activeFeature === null || feature.properties.id !== activeFeature.id) {
				setActiveFeature({ id: feature.properties.id, type: "hover" });
				openPopup(feature);
			}
		};

		const onClick = (e: maplibregl.MapMouseEvent) => {
			const features = map.queryRenderedFeatures(e.point, {
				layers: [layer.id],
			});

			const feature = features[0] as unknown as CircleMarkerFeature;
			if (typeof feature === "undefined") {
				if (activeFeature !== null) {
					closePopup();
				}
				return;
			}

			setActiveFeature({ id: feature.properties.id, type: "selected" });
			openPopup(feature);
			adjustPan();
		};

		const onSourceData = (e: { sourceId: string; source: CircleMarkerSource; sourceDataType: "content" | string }) => {
			if (e.sourceId !== "vehicles" || e.sourceDataType !== "content") return;

			const source = e.source;
			const feature = source.data.features.find((feature) => feature.properties.id === activeFeature?.id);
			if (typeof feature === "undefined") {
				if (activeFeature !== null) {
					closePopup();
				}
				return;
			}

			popup.setLngLat(feature.geometry.coordinates);
			if (activeFeature?.type === "selected") adjustPan();
		};

		map.on("mousemove", onMouseMove);
		map.on("click", onClick);
		map.on("sourcedata", onSourceData);
		return () => {
			map.off("mousemove", onMouseMove);
			map.off("click", onClick);
			map.off("sourcedata", onSourceData);
		};
	}, [activeFeature, adjustPan, closePopup, layer, map, openPopup, popup]);

	return createPortal(
		children({
			activeFeature,
			openPopup: (feature, type) => {
				setActiveFeature({ id: feature.properties.id, type });
				openPopup(feature);
			},
		}),
		containerRef.current,
	);
}
