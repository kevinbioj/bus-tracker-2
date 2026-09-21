import type { Journey } from "../model/journey.js";
import type { Source } from "../model/source.js";
import type { Trip } from "../model/trip.js";

/**
 * Réseau d'une course, tel que la configuration le détermine. Une source peut en alimenter plusieurs
 * (`getNetworkRef` dépendant de la course — la SNCF, par exploitant), si bien qu'un arrêt n'a de réseau
 * qu'à travers les courses qui le desservent.
 *
 * `getNetworkRef` attend une course datée : à défaut, une course théorique est fabriquée pour la
 * question, sans être conservée, et la réponse est gardée pour les appels suivants — elle dépend de la
 * course, pas de sa date.
 */
export function createTripNetworkResolver(source: Source) {
	const cache = new Map<Trip, string>();
	const today = Temporal.Now.plainDateISO();

	return (trip: Trip, journey?: Journey) => {
		if (journey !== undefined) return source.options.getNetworkRef(journey);

		let networkRef = cache.get(trip);
		if (networkRef === undefined) {
			networkRef = source.options.getNetworkRef(trip.getScheduledJourney(today, true));
			cache.set(trip, networkRef);
		}
		return networkRef;
	};
}
