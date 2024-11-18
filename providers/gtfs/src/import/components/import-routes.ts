import { join } from "node:path";
import type { Agency } from "../../model/agency.js";
import { Route, routeTypes } from "../../model/route.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import type { ImportGtfsOptions } from "../import-gtfs.js";

export type RouteRecord = CsvRecord<
  "route_id" | "agency_id" | "route_short_name" | "route_type",
  "route_color" | "route_text_color"
>;

export async function importRoutes(
  gtfsDirectory: string,
  agencies: Map<string, Agency>
) {
  const routes = new Map<string, Route>();

  await readCsv<RouteRecord>(
    join(gtfsDirectory, "routes.txt"),
    (routeRecord) => {
      const agency =
        routeRecord.agency_id?.trim().length > 0
          ? agencies.get(routeRecord.agency_id)
          : agencies.values().next().value;
      if (typeof agency === "undefined") {
        throw new Error(
          `Unknown agency with id '${routeRecord.agency_id}' for route '${routeRecord.route_id}'.`
        );
      }

      const route = new Route(
        routeRecord.route_id,
        agency,
        routeRecord.route_short_name,
        routeRecord.route_type in routeTypes
          ? routeTypes[routeRecord.route_type as keyof typeof routeTypes]
          : "UNKNOWN",
        routeRecord.route_color?.toUpperCase() || "000000",
        routeRecord.route_text_color?.toUpperCase() || "FFFFFF"
      );

      routes.set(route.id, route);
    }
  );

  return routes;
}
