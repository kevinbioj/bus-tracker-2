import { buildStopDepartures } from "../../controllers/stops.js";
import { findLineDetails } from "../../core/services/line-details-service.js";
import { findLineAlerts } from "../../core/services/service-alert-service.js";
import type { Fingerprinter } from "./poll-watcher.js";

export const stopDeparturesFingerprint: Fingerprinter = async (stopRef) => {
	const result = await buildStopDepartures(stopRef, "departures");
	if ("error" in result) return undefined;
	return JSON.stringify(
		result.payload.departures.map((departure) => [
			departure.journeyId ?? departure.aimedTime,
			departure.lineId,
			departure.destination,
			departure.aimedTime,
			departure.expectedTime,
			departure.callStatus,
			departure.platformName,
			departure.atStop,
		]),
	);
};

export const lineAlertsFingerprint: Fingerprinter = async (lineId) => {
	const line = await findLineDetails(Number(lineId));
	if (line === undefined) return undefined;
	const alerts = await findLineAlerts(line);
	return JSON.stringify(alerts.map((alert) => [alert.id, alert.header, alert.description, alert.activePeriods]));
};
