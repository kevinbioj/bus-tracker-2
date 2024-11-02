import type { Agency } from "./agency.js";

export const routeTypes = {
	"0": "TRAMWAY",
	"1": "SUBWAY",
	"2": "RAIL",
	"3": "BUS",
	"4": "FERRY",
	"700": "COACH",
	"-1": "UNKNOWN",
} as const;

export type RouteType = (typeof routeTypes)[keyof typeof routeTypes];

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
