import type { Trip } from "../model/trip.js";

import { importAgencies } from "./components/import-agencies.js";
import { importRoutes } from "./components/import-routes.js";
import { importServices } from "./components/import-services.js";
import { importShapes } from "./components/import-shapes.js";
import { importStops } from "./components/import-stops.js";
import { importTrips } from "./components/import-trips.js";

export type LoadShapesStrategy = "LOAD-IF-EXISTS" | "IGNORE";

export type ImportGtfsOptions = {
	filterTrips?: (trip: Trip) => boolean;
	mapTripId?: (tripId: string) => string;
	mapStopId?: (stopId: string) => string;
	mapRouteId?: (routeId: string) => string;
	shapesStrategy?: LoadShapesStrategy;
	ignoreBlocks?: boolean;
};

export async function importGtfs(gtfsDirectory: string, options: ImportGtfsOptions = {}) {
	const [agencies, services, shapes, stops] = await Promise.all([
		importAgencies(gtfsDirectory),
		importServices(gtfsDirectory),
		importShapes(gtfsDirectory, options),
		importStops(gtfsDirectory, options),
	]);
	const routes = await importRoutes(gtfsDirectory, options, agencies);
	const trips = await importTrips(gtfsDirectory, options, routes, services, shapes, stops);
	return { routes, stops, trips, journeys: [] };
}
