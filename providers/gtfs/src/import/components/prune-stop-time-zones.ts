import type { Agency } from "../../model/agency.js";
import type { Stop } from "../../model/stop.js";

/**
 * Le fuseau d'un arrêt n'est conservé que lorsqu'il diffère de celui de l'agence : partout
 * ailleurs, `stop.timeZone ?? agency.timeZone` donne le même résultat pour moins de mémoire.
 *
 * Quand les agences du jeu de données ne partagent pas toutes le même fuseau, il n'y a pas de
 * référence unique à laquelle comparer : tout est conservé, ce qui reste correct.
 */
export function pruneStopTimeZones(stops: Map<string, Stop>, agencies: Map<string, Agency>) {
	const agencyTimeZones = new Set<string>();
	for (const agency of agencies.values()) {
		agencyTimeZones.add(agency.timeZone);
	}
	if (agencyTimeZones.size !== 1) return;

	const [agencyTimeZone] = agencyTimeZones;
	for (const stop of stops.values()) {
		if (stop.timeZone === agencyTimeZone) {
			stop.timeZone = undefined;
		}
	}
}
