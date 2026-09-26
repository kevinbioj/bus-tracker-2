export type GtfsRt = {
	header: { timestamp: number };
	entity?: GtfsRtEntity[];
};

export type GtfsRtEntity = {
	id: string;
	tripUpdate?: TripUpdate;
	vehicle?: VehiclePosition;
	shape?: RtShape;
	stop?: RtStop;
	tripModifications?: TripModifications;
	alert?: Alert;
};

export type TripUpdate = {
	stopTimeUpdate?: StopTimeUpdate[];
	timestamp: number;
	trip: TripDescriptor;
	vehicle?: VehicleDescriptor;
	tripProperties?: TripProperties;
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

export type StopScheduleRelationship = "SCHEDULED" | "SKIPPED" | "NO_DATA" | "UNSCHEDULED";

export type StopTimeEvent = {
	time?: number;
	delay?: number;
};

/** Valeurs de `StopTimeProperties.pickup_type` / `drop_off_type` (GTFS-RT, expérimental). */
export type DropOffPickupType = "REGULAR" | "NONE" | "PHONE_AGENCY" | "COORDINATE_WITH_DRIVER";

export type StopTimeProperties = {
	assignedStopId?: string;
	stopHeadsign?: string;
	pickupType?: DropOffPickupType;
	dropOffType?: DropOffPickupType;
};

export type StopTimeUpdate = {
	arrival?: StopTimeEvent;
	departure?: StopTimeEvent;
	stopId: string;
	stopSequence?: number;
	scheduleRelationship?: StopScheduleRelationship;
	stopTimeProperties?: StopTimeProperties;
};

/**
 * Désigne la course modifiée par une entité {@link TripModifications} : le descripteur qui la porte
 * a tous ses autres champs vides (spec), l'identité de la course passe donc par `affectedTripId`.
 */
export type ModifiedTripSelector = {
	modificationsId: string;
	affectedTripId: string;
	startTime?: string;
	startDate?: string;
};

export type TripDescriptor = {
	tripId?: string;
	routeId?: string;
	directionId?: number;
	startDate?: string;
	startTime?: string;
	scheduleRelationship?: TripScheduleRelationship;
	modifiedTrip?: ModifiedTripSelector;
};

/** Propriétés d'une course supplémentaire (`NEW`, `DUPLICATED`) ou dont le tracé diffère du théorique. */
export type TripProperties = {
	tripId?: string;
	startDate?: string;
	startTime?: string;
	shapeId?: string;
	tripHeadsign?: string;
	tripShortName?: string;
};

export type TripScheduleRelationship =
	| "SCHEDULED"
	| "ADDED"
	| "UNSCHEDULED"
	| "CANCELED"
	| "REPLACEMENT"
	| "DUPLICATED"
	| "DELETED"
	| "NEW";

export type VehicleDescriptor = {
	id: string;
	label?: string;
	licensePlate?: string;
};

export type VehicleStopStatus = "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO";

// --- Entités de desserte modifiée (expérimentales dans la spec, décodées par les bindings 2.2.0).

export type TranslatedString = {
	translation?: { text: string; language?: string }[];
};

/** Tracé publié par le flux temps réel, en remplacement ou en complément de `shapes.txt`. */
export type RtShape = {
	shapeId: string;
	encodedPolyline: string;
};

/** Arrêt publié par le flux temps réel : un arrêt de déviation absent du GTFS statique. */
export type RtStop = {
	stopId: string;
	stopName?: TranslatedString;
	stopLat?: number;
	stopLon?: number;
	platformCode?: TranslatedString;
	stopTimezone?: string;
	parentStation?: string;
};

/** Désigne un arrêt d'une course d'origine, par séquence ou par identifiant. */
export type StopSelector = {
	stopSequence?: number;
	stopId?: string;
};

export type ReplacementStop = {
	/** Écart, en secondes, avec l'heure d'arrivée à l'arrêt précédant `startStopSelector`. */
	travelTimeToStop?: number;
	stopId?: string;
};

export type Modification = {
	startStopSelector?: StopSelector;
	/** Inclusif. Absent : la modification insère des arrêts sans en retirer aucun. */
	endStopSelector?: StopSelector;
	/** Secondes de retard ajoutées à tous les arrêts suivant la modification, cumulatives. */
	propagatedModificationDelay?: number;
	replacementStops?: ReplacementStop[];
	serviceAlertId?: string;
	lastModifiedTime?: number;
};

export type SelectedTrips = {
	tripIds?: string[];
	shapeId?: string;
};

export type TripModifications = {
	selectedTrips?: SelectedTrips[];
	startTimes?: string[];
	/** Dates de service concernées, au format YYYYMMDD. */
	serviceDates?: string[];
	modifications?: Modification[];
};

/** Une entité `TripModifications` et l'identifiant de l'entité qui la porte (cible de `modificationsId`). */
export type IdentifiedTripModifications = TripModifications & { id: string };

// --- Info trafic.

export type TimeRange = {
	/** Secondes epoch. Absent : depuis toujours. */
	start?: number;
	/** Secondes epoch. Absent : jusqu'à nouvel ordre. */
	end?: number;
};

/** Ce que vise une alerte. Les champs présents se combinent (spec) : route + arrêt désigne cet arrêt sur cette route. */
export type EntitySelector = {
	agencyId?: string;
	routeId?: string;
	routeType?: number;
	directionId?: number;
	trip?: TripDescriptor;
	stopId?: string;
};

export type AlertCause =
	| "UNKNOWN_CAUSE"
	| "OTHER_CAUSE"
	| "TECHNICAL_PROBLEM"
	| "STRIKE"
	| "DEMONSTRATION"
	| "ACCIDENT"
	| "HOLIDAY"
	| "WEATHER"
	| "MAINTENANCE"
	| "CONSTRUCTION"
	| "POLICE_ACTIVITY"
	| "MEDICAL_EMERGENCY"
	| "SPECIAL_EVENT";

export type AlertEffect =
	| "NO_SERVICE"
	| "REDUCED_SERVICE"
	| "SIGNIFICANT_DELAYS"
	| "DETOUR"
	| "ADDITIONAL_SERVICE"
	| "MODIFIED_SERVICE"
	| "OTHER_EFFECT"
	| "UNKNOWN_EFFECT"
	| "STOP_MOVED"
	| "NO_EFFECT"
	| "ACCESSIBILITY_ISSUE";

export type AlertSeverityLevel = "UNKNOWN_SEVERITY" | "INFO" | "WARNING" | "SEVERE";

export type Alert = {
	activePeriod?: TimeRange[];
	informedEntity?: EntitySelector[];
	cause?: AlertCause;
	effect?: AlertEffect;
	severityLevel?: AlertSeverityLevel;
	url?: TranslatedString;
	headerText?: TranslatedString;
	descriptionText?: TranslatedString;
};

/** Une entité `Alert` et l'identifiant de l'entité qui la porte. */
export type IdentifiedAlert = Alert & { id: string };
