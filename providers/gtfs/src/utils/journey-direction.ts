/** Sens publié d'un `direction_id` GTFS ; toute autre valeur laisse le sens inconnu. */
export function toJourneyDirection(directionId: number | undefined) {
	if (directionId === 0) return "OUTBOUND" as const;
	if (directionId === 1) return "INBOUND" as const;
	return undefined;
}
