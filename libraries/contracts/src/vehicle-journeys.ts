import * as z from "zod";

export const vehicleJourneyLineTypes = ["TRAMWAY", "SUBWAY", "RAIL", "BUS", "FERRY", "COACH", "UNKNOWN"] as const;

export const vehicleJourneyLineTypeEnum = z.enum(vehicleJourneyLineTypes);

export type VehicleJourneyLineType = z.infer<typeof vehicleJourneyLineTypeEnum>;

export const vehicleJourneyLineSchema = z.object({
	ref: z.string(),
	number: z.string(),
	type: vehicleJourneyLineTypeEnum,
	color: z
		.string() /*.length(6)*/
		.optional(),
	textColor: z
		.string() /*.length(6)*/
		.optional(),
});
export type VehicleJourneyLine = z.infer<typeof vehicleJourneyLineSchema>;

export const vehicleJourneyCallStatusEnum = z.enum(["SCHEDULED", "UNSCHEDULED", "SKIPPED"]);
export type VehicleJourneyCallStatus = z.infer<typeof vehicleJourneyCallStatusEnum>;

export const vehicleJourneyCallFlagsEnum = z.enum(["NO_PICKUP", "NO_DROP_OFF"]);
export type VehicleJourneyCallFlags = z.infer<typeof vehicleJourneyCallFlagsEnum>;

export const vehicleJourneyCallSchema = z.object({
	aimedTime: z.string().datetime({ offset: true }),
	expectedTime: z.string().datetime({ offset: true }).optional(),
	stopRef: z.string(),
	stopName: z.string(),
	stopOrder: z.number().min(0),
	platformName: z.string().optional(),
	callStatus: vehicleJourneyCallStatusEnum,
	flags: z.array(vehicleJourneyCallFlagsEnum).optional(),
});

export type VehicleJourneyCall = z.infer<typeof vehicleJourneyCallSchema>;

export const vehicleJourneyPositionSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
	bearing: z.number().optional(),
	atStop: z.boolean(),
	type: z.enum(["GPS", "COMPUTED"]),
	recordedAt: z.string().datetime({ offset: true }),
});

export type VehicleJourneyPosition = z.infer<typeof vehicleJourneyPositionSchema>;

export const vehicleJourneyOccupancy = ["LOW", "MEDIUM", "HIGH", "NO_PASSENGERS"] as const;

export const vehicleJourneyOccupancyEnum = z.enum(vehicleJourneyOccupancy);

export const vehicleJourneySchema = z.object({
	id: z.string(),
	line: vehicleJourneyLineSchema.optional(),
	direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
	destination: z.string().optional(),
	calls: z.array(vehicleJourneyCallSchema).optional(),
	position: vehicleJourneyPositionSchema,
	occupancy: vehicleJourneyOccupancyEnum.optional(),
	networkRef: z.string(),
	journeyRef: z.string().optional(),
	operatorRef: z.string().optional(),
	vehicleRef: z.string().optional(),
	serviceDate: z.string().date().optional(),
	updatedAt: z.string().datetime(),
});

export type VehicleJourney = z.infer<typeof vehicleJourneySchema>;
