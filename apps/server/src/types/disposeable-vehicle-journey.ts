export type DisposeableVehicleJourney = {
	id: string;
	/** Code pays ISO 3166-1 alpha-2 hérité du réseau (défaut "FR" en base). */
	countryCode: string;
	lineId?: number;
	direction?: "OUTBOUND" | "INBOUND";
	destination?: string;
	calls?: Array<{
		aimedTime: string;
		expectedTime?: string;
		stopRef: string;
		stopName: string;
		stopOrder: number;
		platformName?: string;
		distanceTraveled?: number;
		callStatus: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	}>;
	position: {
		latitude: number;
		longitude: number;
		bearing?: number;
		atStop: boolean;
		type: "GPS" | "COMPUTED";
		distanceTraveled?: number;
		recordedAt: string;
	};
	occupancy?: "LOW" | "MEDIUM" | "HIGH" | "NO_PASSENGERS";
	pathRef?: string;
	networkId: number;
	operatorId?: number;
	vehicle?: { id?: number; number: string };
	serviceDate?: string;
	updatedAt: string;
};
