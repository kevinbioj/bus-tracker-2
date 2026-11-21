/**
 * Modes retenus pour représenter une station sur la carte, du plus lourd au plus léger : une station
 * prend le plus lourd des modes qui la desservent. Tout autre mode compte comme un bus.
 */
export const stopAreaModes = ["RAIL", "SUBWAY", "TRAMWAY", "BUS", "FUNICULAR"] as const;
