import type { VehicleJourney } from "@bus-tracker/contracts";

/** Course telle que le serveur la garde en mémoire : celle du provider, rattachée aux entités de la base. */
export type DisposeableVehicleJourney = Pick<
	VehicleJourney,
	| "id"
	| "direction"
	| "destination"
	| "calls"
	| "position"
	| "occupancy"
	| "pathRef"
	| "cancelledPathRef"
	| "isAdded"
	| "journeyRef"
	| "missionCode"
	| "wheelchairAccessible"
	| "bikesAllowed"
	| "serviceDate"
	| "updatedAt"
> & {
	/** Code pays ISO 3166-1 alpha-2 hérité du réseau (défaut "FR" en base). */
	countryCode: string;
	lineId?: number;
	networkId: number;
	vehicle?: { id?: number; number: string };
};
