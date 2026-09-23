import type { VehicleJourney } from "@bus-tracker/contracts";

import { groupByProximity } from "./group-by-proximity.js";

/**
 * Distance (m) en deçà de laquelle deux positions GPS sont considérées superposées. Volontairement
 * serrée : seuls les véhicules réellement « l'un sur l'autre » — tracés SAE qui recalent plusieurs
 * bus sur le même point de la voie — doivent être écartés, jamais deux bus qui se suivent.
 */
const OVERLAP_THRESHOLD_METERS = 3;

/** Rayon (m) du cercle sur lequel les véhicules superposés sont répartis. */
const SCATTER_RADIUS_METERS = 6;

/**
 * Nombre de positions possibles sur un anneau. Deux véhicules de secteurs voisins sont séparés de
 * `2 × rayon × sin(π / SECTOR_COUNT)`, soit ~4,6 m sur l'anneau intérieur : assez pour deux
 * marqueurs distincts. L'augmenter réduit les collisions de secteur mais rapproche les véhicules.
 */
const SECTOR_COUNT = 8;

/** Écart (m) entre deux anneaux, utilisé une fois l'anneau intérieur saturé. */
const RING_STEP_METERS = 5;

const METERS_PER_DEGREE_LATITUDE = 111_320;

/** Hash FNV-1a 32 bits, utilisé pour orienter une grappe de façon stable dans le temps. */
function hashString(value: string) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

type PositionedJourney = VehicleJourney & { position: NonNullable<VehicleJourney["position"]> };

/**
 * Écarte les véhicules dont les positions GPS sont strictement superposées, en les répartissant sur
 * un petit cercle autour de leur point commun. Certains SAE recalent plusieurs véhicules sur le même
 * point du tracé : sans cela, un seul marqueur est visible et les autres sont inatteignables.
 *
 * Le décalage est déterministe et propre à chaque véhicule : il dérive d'un hash de son identifiant
 * et s'applique à sa propre position, jamais à un centre partagé. Un véhicule qui rejoint ou quitte
 * la grappe ne déplace donc pas les autres, et aucun ne gigote d'un cycle de calcul à l'autre.
 * Les positions isolées ne sont jamais modifiées.
 *
 * @returns Le nombre de véhicules effectivement déplacés.
 */
export function scatterOverlappingPositions(vehicleJourneys: Iterable<VehicleJourney>) {
	const candidates: PositionedJourney[] = [];
	for (const vehicleJourney of vehicleJourneys) {
		// Seules les positions GPS sont concernées : les positions calculées sont ancrées aux arrêts
		// ou au tracé, où une superposition est légitime.
		if (vehicleJourney.position?.type !== "GPS") continue;
		candidates.push(vehicleJourney as PositionedJourney);
	}
	if (candidates.length < 2) return 0;

	// Composantes connexes : trois véhicules superposés deux à deux forment une seule grappe, même si
	// les paires ne sont pas toutes à moins du seuil.
	const clusters = groupByProximity(candidates, (candidate) => candidate.position, OVERLAP_THRESHOLD_METERS);

	let scatteredCount = 0;

	for (const cluster of clusters) {
		if (cluster.length < 2) continue;

		// Le tri par identifiant fixe l'ordre d'attribution des secteurs indépendamment de l'ordre
		// d'itération du flux temps réel, qui n'est pas garanti stable.
		cluster.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

		const takenSlots = new Set<number>();

		for (const vehicleJourney of cluster) {
			// Le secteur ne dépend que de l'identifiant du véhicule : l'arrivée ou le départ d'un
			// voisin ne redistribue pas la grappe. Seule une collision de secteur peut déplacer un
			// véhicule, et uniquement celui qui la subit — jamais celui déjà installé.
			const preferredSector = hashString(vehicleJourney.id) % SECTOR_COUNT;

			let slot = preferredSector;
			for (let attempt = 1; takenSlots.has(slot); attempt++) {
				// Sondage linéaire sur l'anneau, puis passage à l'anneau suivant une fois saturé.
				slot = Math.floor(attempt / SECTOR_COUNT) * SECTOR_COUNT + ((preferredSector + attempt) % SECTOR_COUNT);
			}
			takenSlots.add(slot);

			const ring = Math.floor(slot / SECTOR_COUNT);
			const angle = (2 * Math.PI * (slot % SECTOR_COUNT)) / SECTOR_COUNT;
			const radius = SCATTER_RADIUS_METERS + ring * RING_STEP_METERS;

			// Chaque véhicule s'écarte de sa propre position, et non d'un centre commun : celui-ci
			// dépendrait de la composition de la grappe. L'écart entre membres étant inférieur au
			// seuil de superposition, la figure obtenue est la même à moins d'un mètre près.
			const { latitude, longitude } = vehicleJourney.position;
			const metersPerDegreeLongitude = Math.max(1, METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180));

			vehicleJourney.position = {
				...vehicleJourney.position,
				latitude: latitude + (radius * Math.sin(angle)) / METERS_PER_DEGREE_LATITUDE,
				longitude: longitude + (radius * Math.cos(angle)) / metersPerDegreeLongitude,
			};
			scatteredCount += 1;
		}
	}

	return scatteredCount;
}
