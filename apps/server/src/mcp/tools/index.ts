import type { BusTrackerTool } from "../define-tool.js";
import { findNearbyVehiclesTool } from "./journeys/find-nearby-vehicles.js";
import { getJourneyTool } from "./journeys/get-journey.js";
import { getLineAlertsTool } from "./lines/get-line-alerts.js";
import { getLineStatusTool } from "./lines/get-line-status.js";
import { getLineStopsTool } from "./lines/get-line-stops.js";
import { getLineVehicleAssignmentsTool } from "./lines/get-line-vehicle-assignments.js";
import { getNetworkLinesTool } from "./lines/get-network-lines.js";
import { searchLinesTool } from "./lines/search-lines.js";
import { getFleetOverviewTool } from "./networks/get-fleet-overview.js";
import { getNetworkTool } from "./networks/get-network.js";
import { searchNetworksTool } from "./networks/search-networks.js";
import { getAnnouncementsTool } from "./platform/get-announcements.js";
import { findStopsNearbyTool } from "./stops/find-stops-nearby.js";
import { getNearbyDeparturesTool } from "./stops/get-nearby-departures.js";
import { getStopTool } from "./stops/get-stop.js";
import { getStopDeparturesTool } from "./stops/get-stop-departures.js";
import { searchStopsTool } from "./stops/search-stops.js";
import { getVehicleTool } from "./vehicles/get-vehicle.js";
import { getVehicleHistoryTool } from "./vehicles/get-vehicle-history.js";
import { searchVehiclesTool } from "./vehicles/search-vehicles.js";

export const tools: BusTrackerTool[] = [
	searchNetworksTool,
	getNetworkTool,
	getFleetOverviewTool,
	searchLinesTool,
	getNetworkLinesTool,
	getLineStatusTool,
	getLineAlertsTool,
	getLineVehicleAssignmentsTool,
	getLineStopsTool,
	searchStopsTool,
	findStopsNearbyTool,
	getStopTool,
	getStopDeparturesTool,
	getNearbyDeparturesTool,
	getJourneyTool,
	findNearbyVehiclesTool,
	searchVehiclesTool,
	getVehicleTool,
	getVehicleHistoryTool,
	getAnnouncementsTool,
];

export {
	getJourneyTool,
	getLineAlertsTool,
	getLineStatusTool,
	getNetworkTool,
	getStopDeparturesTool,
	getVehicleTool,
	searchNetworksTool,
};
