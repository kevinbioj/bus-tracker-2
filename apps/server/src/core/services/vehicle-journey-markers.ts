import {
	getVehicleJourneyPositionType,
	type VehicleJourneyMarker,
	type VehicleJourneyPositionType,
} from "@bus-tracker/contracts";
import { inArray } from "drizzle-orm";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { useCache } from "../../utils/use-cache.js";
import { database } from "../database/database.js";
import { linesTable } from "../database/schema.js";

export type MarkersFilter = {
	swLat: number;
	swLon: number;
	neLat: number;
	neLon: number;
	networkIds?: number[];
	lineIds?: number[];
	positionTypes?: VehicleJourneyPositionType[];
	excludeScheduled?: boolean;
	countryCodes?: Set<string>;
};

export type MarkerLineStyle = { number: string; color: string | null; textColor: string | null };

export function matchesMarkersFilter(journey: DisposeableVehicleJourney, filter: MarkersFilter) {
	if (filter.countryCodes !== undefined && !filter.countryCodes.has(journey.countryCode)) {
		return false;
	}

	if (filter.positionTypes !== undefined) {
		if (!filter.positionTypes.includes(getVehicleJourneyPositionType(journey))) {
			return false;
		}
	} else if (filter.excludeScheduled && getVehicleJourneyPositionType(journey) === "SCHEDULED") {
		return false;
	}

	if (filter.lineIds !== undefined) {
		return journey.lineId !== undefined && filter.lineIds.includes(journey.lineId);
	}

	if (filter.networkIds !== undefined) {
		return filter.networkIds.includes(journey.networkId);
	}

	const { latitude, longitude } = journey.position;
	return filter.swLat <= latitude && latitude <= filter.neLat && filter.swLon <= longitude && longitude <= filter.neLon;
}

export function toMarker(journey: DisposeableVehicleJourney, line: MarkerLineStyle | undefined): VehicleJourneyMarker {
	const { latitude, longitude, bearing, type } = journey.position;
	return {
		id: journey.id,
		lineNumber: line?.number,
		vehicleNumber: journey.vehicle?.number,
		color: line?.textColor ? `#${line.textColor}` : undefined,
		fillColor: line?.color ? `#${line.color}` : undefined,
		position: { latitude, longitude, bearing, type },
	};
}

const lineStyles = useCache<MarkerLineStyle>(60_000);

export async function loadLineStyles(lineIds: Iterable<number>) {
	const styles = new Map<number, MarkerLineStyle>();
	const missingIds: number[] = [];

	for (const lineId of new Set(lineIds)) {
		const style = lineStyles.get(String(lineId));
		if (style !== undefined) styles.set(lineId, style);
		else missingIds.push(lineId);
	}

	if (missingIds.length > 0) {
		const lines = await database
			.select({
				id: linesTable.id,
				number: linesTable.number,
				color: linesTable.color,
				textColor: linesTable.textColor,
			})
			.from(linesTable)
			.where(inArray(linesTable.id, missingIds));

		for (const { id, ...style } of lines) {
			lineStyles.set(String(id), style);
			styles.set(id, style);
		}
	}

	return styles;
}
