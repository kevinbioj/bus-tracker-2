export type DisposeableVehicleJourney = {
	id: string;
	lineId?: number;
	direction?: "OUTBOUND" | "INBOUND";
	destination?: string;
	calls?: Array<{
		aimedTime: string;
		expectedTime?: string;
		stopRef: string;
		stopName: string;
		stopOrder: number;
		callStatus: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	}>;
	position: {
		latitude: number;
		longitude: number;
		bearing?: number;
		atStop: boolean;
		type: "GPS" | "COMPUTED";
		recordedAt: string;
	};
	occupancy?: "LOW" | "MEDIUM" | "HIGH" | "NO_PASSENGERS";
	networkId: number;
	operatorId?: number;
	vehicle?: { id?: number; number: string };
	serviceDate?: string;
	updatedAt: string;
};
