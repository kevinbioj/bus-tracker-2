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
		flags?: ("NO_PICKUP" | "NO_DROP_OFF")[];
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
	/** Portions du tracé théorique que la course, déviée, n'emprunte plus. */
	cancelledPathRef?: string;
	/** Course absente du GTFS statique : ses arrêts n'ont pas d'horaire théorique de référence. */
	isAdded?: boolean;
	networkId: number;
	/** Course théorique dont la publication est issue, lorsqu'elle en a une. */
	journeyRef?: string;
	operatorId?: number;
	vehicle?: { id?: number; number: string };
	missionCode?: string;
	serviceDate?: string;
	updatedAt: string;
};
