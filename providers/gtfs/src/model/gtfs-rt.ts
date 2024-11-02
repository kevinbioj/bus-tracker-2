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
	position: Position;
	stopId?: string;
	timestamp: number;
	trip?: TripDescriptor;
	vehicle: VehicleDescriptor;
};

// ---

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
