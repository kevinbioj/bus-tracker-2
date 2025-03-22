export type GtfsRt = {
	header: { timestamp: number };
	entity?: GtfsRtEntity[];
};

export type GtfsRtEntity = {
	id: string;
	tripUpdate?: TripUpdate;
	vehicle?: VehiclePosition;
};

export type TripUpdate = {
	stopTimeUpdate?: StopTimeUpdate[];
	timestamp: number;
	trip: TripDescriptor;
	vehicle?: VehicleDescriptor;
};

export type VehiclePosition = {
	currentStatus?: VehicleStopStatus;
	currentStopSequence?: number;
	occupancyStatus?: OccupancyStatus;
	position: Position;
	stopId?: string;
	timestamp: number;
	trip?: TripDescriptor;
	vehicle: VehicleDescriptor;
};

// ---

export type OccupancyStatus =
	| "EMPTY"
	| "MANY_SEATS_AVAILABLE"
	| "FEW_SEATS_AVAILABLE"
	| "STANDING_ROOM_ONLY"
	| "CRUSHED_STANDING_ROOM_ONLY"
	| "FULL"
	| "NOT_ACCEPTING_PASSENGERS"
	| "NO_DATA_AVAILABLE"
	| "NOT_BOARDABLE";

export type Position = {
	latitude: number;
	longitude: number;
	bearing?: number;
};

export type StopScheduleRelationship = "SCHEDULED" | "SKIPPED" | "NO_DATA";

export type StopTimeEvent = {
	time?: number;
	delay?: number;
};

export type StopTimeUpdate = {
	arrival?: StopTimeEvent;
	departure?: StopTimeEvent;
	stopId: string;
	stopSequence?: number;
	scheduleRelationship?: StopScheduleRelationship;
	stopTimeProperties?: {
		assignedStopId?: string;
	};
};

export type TripDescriptor = {
	tripId: string;
	routeId?: string;
	directionId?: number;
	startDate?: string;
	scheduleRelationship?: TripScheduleRelationship;
};

export type TripScheduleRelationship = "SCHEDULED" | "CANCELED";

export type VehicleDescriptor = {
	id: string;
	label?: string;
};

export type VehicleStopStatus = "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO";
