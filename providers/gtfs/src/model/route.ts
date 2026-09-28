import type { Agency } from "./agency.js";

/** Types de route de la spécification GTFS. */
const baseRouteTypes = {
	"0": "TRAMWAY",
	"1": "SUBWAY",
	"2": "RAIL",
	"3": "BUS",
	"4": "FERRY",
	"5": "TRAMWAY",
	"6": "GONDOLA",
	"7": "FUNICULAR",
	"11": "TROLLEY",
	"12": "SUBWAY",
} as const;

/**
 * Types de route étendus (« Extended GTFS Route Types », sur la base de la classification HVT), par
 * famille : la centaine en donne le mode, le détail (régional, express, nocturne…) n'importe pas ici.
 */
const extendedRouteTypeFamilies = {
	1: "RAIL", // 1xx : services ferroviaires
	2: "COACH", // 2xx : autocars
	3: "RAIL", // 3xx : trains de banlieue
	4: "SUBWAY", // 4xx : réseaux ferrés urbains, monorails
	5: "SUBWAY", // 5xx : métros
	6: "SUBWAY", // 6xx : métros souterrains
	7: "BUS", // 7xx : bus
	8: "TROLLEY", // 8xx : trolleybus
	9: "TRAMWAY", // 9xx : tramways
	10: "FERRY", // 10xx : transport fluvial
	12: "FERRY", // 12xx : ferries
	13: "GONDOLA", // 13xx : remontées mécaniques
	14: "FUNICULAR", // 14xx : funiculaires
	15: "BUS", // 15xx : taxis (transport à la demande)
} as const;

export type RouteType =
	| (typeof baseRouteTypes)[keyof typeof baseRouteTypes]
	| (typeof extendedRouteTypeFamilies)[keyof typeof extendedRouteTypeFamilies]
	| "UNKNOWN";

export function parseRouteType(value: string): RouteType {
	const routeType = value.trim();
	if (Object.hasOwn(baseRouteTypes, routeType)) return baseRouteTypes[routeType as keyof typeof baseRouteTypes];

	// Historique : `700` est lu comme un autocar, et non comme le bus de la classification étendue.
	if (routeType === "700") return "COACH";

	const code = Number(routeType);
	if (!Number.isInteger(code) || code < 100) return "UNKNOWN";

	const family = Math.floor(code / 100);
	return Object.hasOwn(extendedRouteTypeFamilies, family)
		? extendedRouteTypeFamilies[family as keyof typeof extendedRouteTypeFamilies]
		: "UNKNOWN";
}

export class Route {
	constructor(
		readonly id: string,
		readonly agency: Agency,
		readonly name: string,
		readonly type: RouteType,
		readonly color?: string,
		readonly textColor?: string,
	) {}
}
