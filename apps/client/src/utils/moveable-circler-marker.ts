import { type EventedProps, createLayerComponent } from "@react-leaflet/core";
import { CircleMarker, type CircleMarkerOptions, type LatLngExpression, Util } from "leaflet";
import type { ReactNode } from "react";

export type MoveableCircleMarkerProps = CircleMarkerOptions &
	EventedProps & {
		children?: ReactNode;
		position: LatLngExpression;
		duration: number;
		keepAtCenter?: boolean;
	};

type slideOptions = {
	duration: number;
	keepAtCenter?: boolean;
};

export class MoveableCircleMarker extends CircleMarker {
	private _slideToUntil = 0;
	private _slideToDuration = 1000;
	private _slideToLatLng: LatLngExpression = [0, 0];
	private _slideFromLatLng: LatLngExpression = [0, 0];
	private _slideKeepAtCenter = false;
	private _slideDraggingWasAllowed = false;
	private _slideFrame = 0;

	addInitHook = () => {
		this.on("move", this.slideCancel, this);
	};

	// 🍂method slideTo(latlng: LatLng, options: Slide Options): this
	// Moves this marker until `latlng`, like `setLatLng()`, but with a smooth
	// sliding animation. Fires `movestart` and `moveend` events.
	slideTo = (latlng: LatLngExpression, options: slideOptions) => {
		if (!this._map) return;

		this._slideToDuration = options.duration;
		this._slideToUntil = performance.now() + options.duration;
		this._slideFromLatLng = this.getLatLng();
		this._slideToLatLng = latlng;
		this._slideKeepAtCenter = !!options.keepAtCenter;
		this._slideDraggingWasAllowed = this._slideDraggingWasAllowed ?? this._map.dragging.enabled();

		if (this._slideKeepAtCenter) {
			this._map.dragging.disable();
			this._map.doubleClickZoom.disable();
			this._map.options.touchZoom = "center";
			this._map.options.scrollWheelZoom = "center";
		}

		this.fire("movestart");
		this._slideTo();

		return this;
	};

	// 🍂method slideCancel(): this
	// Cancels the sliding animation from `slideTo`, if applicable.
	slideCancel() {
		Util.cancelAnimFrame(this._slideFrame);
	}

	private _slideTo = () => {
		if (!this._map) return;

		const remaining = this._slideToUntil - performance.now();

		if (remaining < 0) {
			this.setLatLng(this._slideToLatLng);
			this.fire("moveend");
			if (this._slideDraggingWasAllowed) {
				this._map.dragging.enable();
				this._map.doubleClickZoom.enable();
				this._map.options.touchZoom = true;
				this._map.options.scrollWheelZoom = true;
			}
			this._slideDraggingWasAllowed = false;
			return this;
		}

		const startPoint = this._map.latLngToContainerPoint(this._slideFromLatLng);
		const endPoint = this._map.latLngToContainerPoint(this._slideToLatLng);
		const percentDone = (this._slideToDuration - remaining) / this._slideToDuration;

		const currPoint = endPoint.multiplyBy(percentDone).add(startPoint.multiplyBy(1 - percentDone));
		const currLatLng = this._map.containerPointToLatLng(currPoint);
		this.setLatLng(currLatLng);

		if (this._slideKeepAtCenter) {
			this._map.panTo(currLatLng, { animate: false });
		}

		this._slideFrame = Util.requestAnimFrame(this._slideTo, this);
	};
}

const ReactMoveableCircleMarker = createLayerComponent<MoveableCircleMarker, MoveableCircleMarkerProps>(
	function createMarker({ position, ...options }, ctx) {
		const instance = new MoveableCircleMarker(position, options);
		return { instance, context: { ...ctx, overlayContainer: instance } };
	},
	function updateMarker(marker, props, prevProps) {
		if (prevProps.position !== props.position && typeof props.duration === "number") {
			marker.slideTo(props.position, {
				duration: props.duration,
				keepAtCenter: props.keepAtCenter,
			});
		}
	},
);

export default ReactMoveableCircleMarker;
