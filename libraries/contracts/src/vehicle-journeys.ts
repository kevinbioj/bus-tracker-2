import * as z from "zod";

export const vehicleJourneyLineTypeEnum = z.enum(["TRAMWAY", "SUBWAY", "RAIL", "BUS", "FERRY", "COACH", "UNKNOWN"]);

export type VehicleJourneyLineType = z.infer<typeof vehicleJourneyLineTypeEnum>;

export const vehicleJourneyLineSchema = z.object({
	ref: z.string(),
	number: z.string(),
	type: vehicleJourneyLineTypeEnum,
	color: z.string().length(6).optional(),
	textColor: z.string().length(6).optional(),
});

export type VehicleJourneyLine = z.infer<typeof vehicleJourneyLineSchema>;

export const vehicleJourneyCallStatusEnum = z.enum(["SCHEDULED", "SKIPPED"]);

export type VehicleJourneyCallStatus = z.infer<typeof vehicleJourneyCallStatusEnum>;

export const vehicleJourneyCallSchema = z.object({
	aimedTime: z.string().datetime({ offset: true }),
	expectedTime: z.string().datetime({ offset: true }).optional(),
	stopRef: z.string(),
	stopName: z.string(),
	stopOrder: z.number().min(0),
	callStatus: vehicleJourneyCallStatusEnum,
});

export type VehicleJourneyCall = z.infer<typeof vehicleJourneyCallSchema>;

export const vehicleJourneyPositionSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
	atStop: z.boolean(),
	type: z.enum(["GPS", "COMPUTED"]),
	recordedAt: z.string().datetime({ offset: true }),
});

export type VehicleJourneyPosition = z.infer<typeof vehicleJourneyPositionSchema>;

export const vehicleJourneySchema = z.object({
	id: z.string(),
	line: vehicleJourneyLineSchema.optional(),
	direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
	destination: z.string().optional(),
	calls: z.array(vehicleJourneyCallSchema).optional(),
	position: vehicleJourneyPositionSchema,
	networkRef: z.string(),
	journeyRef: z.string().optional(),
	operatorRef: z.string().optional(),
	vehicleRef: z.string().optional(),
	serviceDate: z.string().date().optional(),
	updatedAt: z.string().datetime(),
});

export type VehicleJourney = z.infer<typeof vehicleJourneySchema>;
