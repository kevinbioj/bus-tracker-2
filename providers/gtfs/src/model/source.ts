import type { ImportGtfsOptions } from "../import/import-gtfs.js";
import type { TripUpdate, VehicleDescriptor, VehiclePosition } from "./gtfs-rt.js";
import type { Gtfs } from "./gtfs.js";
import type { Journey } from "./journey.js";
import type { Trip } from "./trip.js";

export type Source = {
	id: string;
	// --- Data provisioning
	staticResourceHref: string;
	realtimeResourceHrefs?: string[];
	gtfsOptions?: ImportGtfsOptions;
	// --- Additional data acquirance
	allowScheduled?: (trip: Trip) => boolean;
	getAheadTime?: (journey?: Journey) => number;
	getNetworkRef: (journey?: Journey, vehicle?: VehicleDescriptor) => string;
	getOperatorRef?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
	getVehicleRef?: (vehicle?: VehicleDescriptor) => string | undefined;
	// --- Data transformation
	mapLineRef?: (lineRef: string) => string;
	mapStopRef?: (stopRef: string) => string;
	mapTripRef?: (tripRef: string) => string;
	mapTripUpdate?: (tripUpdate: TripUpdate) => TripUpdate;
	mapVehiclePosition?: (vehicle: VehiclePosition) => VehiclePosition;
	// --- Runtime data
	gtfs?: Gtfs;
};
