import type { StationRecord, Stop } from "../../model/stop.js";
import { StopArea } from "../../model/stop-area.js";

/**
 * Écart au-delà duquel deux arrêts homonymes sans station parente cessent d'être considérés comme
 * les quais d'un même lieu. Large assez pour réunir les deux sens d'un boulevard ou les quais d'un
 * pôle d'échange, étroit assez pour ne pas confondre deux « Mairie » de communes voisines.
 */
const MAX_SIBLING_DISTANCE_M = 150;

const EARTH_RADIUS_M = 6_371_000;

/** Distance approchée, en mètres : à cette échelle, une projection équirectangulaire locale suffit. */
function distanceBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
	const meanLatitude = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
	const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
	const dLon = (b.longitude - a.longitude) * (Math.PI / 180) * Math.cos(meanLatitude);
	return Math.hypot(dLat, dLon) * EARTH_RADIUS_M;
}

/**
 * Forme comparable d'un nom d'arrêt : sans casse, sans accent, sans ponctuation ni espaces
 * surnuméraires. « Théâtre des Arts » et « THEATRE DES ARTS » désignent le même lieu.
 */
export function normalizeStopName(name: string) {
	return name
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, " ")
		.trim();
}

function centroidOf(stops: Stop[]) {
	let latitude = 0;
	let longitude = 0;
	for (const stop of stops) {
		latitude += stop.latitude;
		longitude += stop.longitude;
	}
	return { latitude: latitude / stops.length, longitude: longitude / stops.length };
}

/**
 * Rapproche des homonymes en grappes : un arrêt rejoint la première grappe dont il est assez proche,
 * et en ouvre une sinon. Les arrêts sont parcourus dans l'ordre de leur identifiant, ce qui rend le
 * découpage — et donc les identifiants de station qui en découlent — stable d'un import à l'autre.
 */
function clusterByProximity(stops: Stop[]) {
	const clusters: Stop[][] = [];

	for (const stop of stops) {
		const cluster = clusters.find((members) => distanceBetween(centroidOf(members), stop) <= MAX_SIBLING_DISTANCE_M);
		if (cluster !== undefined) {
			cluster.push(stop);
		} else {
			clusters.push([stop]);
		}
	}

	return clusters;
}

export type GroupedStopAreas = {
	stopAreas: Map<string, StopArea>;
	/** Station d'appartenance de chaque arrêt, indexée par identifiant d'arrêt (après `mapStopId`). */
	stopAreaByStopId: Map<string, string>;
};

/**
 * Regroupe en stations les arrêts effectivement desservis. Un arrêt dont la `parent_station` est
 * déclarée rejoint celle-ci ; les autres sont rapprochés par nom puis par proximité. Un arrêt qui ne
 * trouve aucun voisin forme sa propre station : la carte reste exhaustive.
 */
export function groupStopAreas(servedStops: Iterable<Stop>, stations: Map<string, StationRecord>): GroupedStopAreas {
	const byStation = new Map<string, Stop[]>();
	const orphansByName = new Map<string, Stop[]>();

	const sortedStops = Array.from(servedStops).sort((a, b) => a.id.localeCompare(b.id));

	for (const stop of sortedStops) {
		// Une `parent_station` qui ne désigne aucune station déclarée ne rattache à rien : l'arrêt
		// retombe sur le rapprochement par nom.
		const station = stop.parentStationId !== undefined ? stations.get(stop.parentStationId) : undefined;

		if (station !== undefined) {
			const members = byStation.get(station.id);
			if (members !== undefined) {
				members.push(stop);
			} else {
				byStation.set(station.id, [stop]);
			}
			continue;
		}

		const name = normalizeStopName(stop.name);
		const members = orphansByName.get(name);
		if (members !== undefined) {
			members.push(stop);
		} else {
			orphansByName.set(name, [stop]);
		}
	}

	const stopAreas = new Map<string, StopArea>();
	const stopAreaByStopId = new Map<string, string>();

	const register = (id: string, name: string, stops: Stop[]) => {
		const { latitude, longitude } = centroidOf(stops);
		stopAreas.set(id, new StopArea(id, name, latitude, longitude, stops));
		for (const stop of stops) {
			stopAreaByStopId.set(stop.id, id);
		}
	};

	for (const [stationId, stops] of byStation) {
		register(stationId, stations.get(stationId)!.name, stops);
	}

	for (const stops of orphansByName.values()) {
		for (const cluster of clusterByProximity(stops)) {
			// L'identifiant du premier quai fait office d'identifiant de station : il est unique, et
			// stable tant que ce quai est desservi.
			register(cluster[0]!.id, cluster[0]!.name, cluster);
		}
	}

	return { stopAreas, stopAreaByStopId };
}
