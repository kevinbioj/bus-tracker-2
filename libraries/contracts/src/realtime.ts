import { z } from "zod";

import type { EncodedLinePath, EncodedVehicleJourneyPaths } from "./line-paths.js";
import { vehicleJourneyPositionTypes } from "./vehicle-journeys.js";

export const REALTIME_PROTOCOL_VERSION = 1;

export type VehicleJourneyMarker = {
	id: string;
	lineNumber?: string;
	vehicleNumber?: string;
	color?: string;
	fillColor?: string;
	position: { latitude: number; longitude: number; bearing?: number; type: "GPS" | "COMPUTED" };
};

export const realtimeClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("subscribe-markers"),
		seq: z.number().int().nonnegative(),
		swLat: z.number().min(-90).max(90),
		swLon: z.number().min(-180).max(180),
		neLat: z.number().min(-90).max(90),
		neLon: z.number().min(-180).max(180),
		networkIds: z.array(z.number().int()).max(50).optional(),
		lineIds: z.array(z.number().int()).max(50).optional(),
		positionTypes: z.array(z.enum(vehicleJourneyPositionTypes)).optional(),
		countryCodes: z.array(z.string().max(8)).max(50).optional(),
		includeMarker: z.string().max(512).optional(),
	}),
	z.object({
		type: z.literal("watch-journey"),
		id: z.string().max(512).nullable(),
	}),
	z.object({
		type: z.literal("subscribe-stops"),
		seq: z.number().int().nonnegative(),
		subscription: z
			.object({
				swLat: z.number().min(-90).max(90),
				swLon: z.number().min(-180).max(180),
				neLat: z.number().min(-90).max(90),
				neLon: z.number().min(-180).max(180),
				networkIds: z.array(z.number().int()).max(50).optional(),
				lineId: z.number().int().optional(),
				withStopPoints: z.boolean(),
			})
			.nullable(),
	}),
	z.object({
		type: z.literal("watch-stop"),
		stop: z
			.object({
				ref: z.string().max(512),
				direction: z.enum(["departures", "arrivals"]),
				lineId: z.number().int().optional(),
			})
			.nullable(),
	}),
]);

export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;

export type RealtimeMarkersSubscription = Extract<RealtimeClientMessage, { type: "subscribe-markers" }>;

export type RealtimeJourneyUpdate<TDetails> = { id: string; details: TDetails } | { id: string; unavailable: true };

export type RealtimePayloadTypes = {
	journey: unknown;
	alert: unknown;
	line: unknown;
	stopMarker: unknown;
	stopDepartures: unknown;
};

export type RealtimeStopWatch = NonNullable<Extract<RealtimeClientMessage, { type: "watch-stop" }>["stop"]>;

export type RealtimeUpdateMessage<T extends RealtimePayloadTypes = RealtimePayloadTypes> = {
	type: "update";
	markers?: { seq: number; upsert: VehicleJourneyMarker[]; remove: string[] };
	journey?: RealtimeJourneyUpdate<T["journey"]>;
	journeyAlerts?: { journeyId: string; items: T["alert"][] };
	journeyPaths?: { journeyId: string; pathRef: string; paths: EncodedVehicleJourneyPaths | null };
	lines?: { lineId: number; line: T["line"] | null }[];
	linePaths?: { lineId: number; path: EncodedLinePath | null }[];
	lineAlerts?: { lineId: number; items: T["alert"][] }[];
	stops?: { seq: number; upsert: T["stopMarker"][]; remove: string[] };
	stopDepartures?: RealtimeStopWatch & ({ departures: T["stopDepartures"] } | { unavailable: true });
	stopAlerts?: { ref: string; items: T["alert"][] };
	at: string;
};

export type RealtimeServerMessage<T extends RealtimePayloadTypes = RealtimePayloadTypes> =
	| { type: "hello"; version: number }
	| RealtimeUpdateMessage<T>;
