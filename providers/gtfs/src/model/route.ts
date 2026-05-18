import type { Agency } from "./agency.js";

export const routeTypes = {
	"0": "TRAMWAY",
	"1": "SUBWAY",
	"2": "RAIL",
	"3": "BUS",
	"4": "FERRY",
	"6": "GONDOLA",
	"7": "FUNICULAR",
	"700": "COACH",
	"1300": "GONDOLA",
	"1301": "GONDOLA",
	"1302": "GONDOLA",
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
